package com.example.backend.service;

import com.example.backend.dto.auth.AuthRequest;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.dto.auth.SignupRequest;
import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import com.example.backend.security.JwtService;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    public AuthResponse signup(SignupRequest request) {
        validateSignup(request);

        String email = request.getEmail().trim();
        String username = request.getUsername().trim();

        userRepository.findByEmail(email).ifPresent(existingUser -> {
            if (StringUtils.hasText(existingUser.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered.");
            }
        });
        userRepository.findByUsername(username).ifPresent(user -> {
            if (!email.equals(user.getEmail())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken.");
            }
        });

        User savedUser = userRepository.findByEmail(email)
                .map(existingUser -> {
                    existingUser.setName(request.getName().trim());
                    existingUser.setUsername(username);
                    existingUser.setPasswordHash(passwordEncoder.encode(request.getPassword()));
                    existingUser.setProvider("LOCAL");
                    if (existingUser.getRoles() == null || existingUser.getRoles().isEmpty()) {
                        existingUser.setRoles(Set.of("USER"));
                    }
                    return userRepository.save(existingUser);
                })
                .orElseGet(() -> userRepository.save(User.builder()
                        .email(email)
                        .name(request.getName().trim())
                        .username(username)
                        .passwordHash(passwordEncoder.encode(request.getPassword()))
                        .provider("LOCAL")
                        .roles(Set.of("USER"))
                        .build()));

        return buildAuthResponse(savedUser);
    }

    public AuthResponse login(AuthRequest request) {
        if (!StringUtils.hasText(request.getEmail()) || !StringUtils.hasText(request.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        User user = userRepository.findByEmail(request.getEmail().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials."));

        if (!StringUtils.hasText(user.getPasswordHash())
                || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials.");
        }

        return buildAuthResponse(user);
    }

    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        return UserProfileResponse.from(user);
    }

    public AuthResponse buildAuthResponse(User user) {
        return AuthResponse.builder()
                .token(jwtService.generateToken(user.getId(), user.getEmail()))
                .user(UserProfileResponse.from(user))
                .build();
    }

    public User upsertOAuthUser(String email, String name, String provider, String oauthToken) {
        return userRepository.findByEmail(email)
                .map(existingUser -> {
                    existingUser.setName(StringUtils.hasText(name) ? name : existingUser.getName());
                    existingUser.setProvider(provider);
                    applyOAuthToken(existingUser, provider, oauthToken);
                    return userRepository.save(existingUser);
                })
                .orElseGet(() -> userRepository.save(
                        User.builder()
                                .email(email)
                                .name(StringUtils.hasText(name) ? name : email)
                                .username(buildUniqueUsername(email))
                                .provider(provider)
                                .githubOAuthToken("GITHUB".equals(provider) ? oauthToken : null)
                                .googleOAuthToken("GOOGLE".equals(provider) ? oauthToken : null)
                                .roles(Set.of("USER"))
                                .build()
                ));
    }

    private void applyOAuthToken(User user, String provider, String oauthToken) {
        if ("GITHUB".equals(provider)) {
            user.setGithubOAuthToken(oauthToken);
        } else if ("GOOGLE".equals(provider)) {
            user.setGoogleOAuthToken(oauthToken);
        }
    }

    private String buildUniqueUsername(String email) {
        String baseUsername = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        String candidate = baseUsername;
        int suffix = 1;

        while (userRepository.findByUsername(candidate).isPresent()) {
            candidate = baseUsername + suffix++;
        }

        return candidate;
    }

    private void validateSignup(SignupRequest request) {
        if (!StringUtils.hasText(request.getEmail())
                || !StringUtils.hasText(request.getName())
                || !StringUtils.hasText(request.getUsername())
                || !StringUtils.hasText(request.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All signup fields are required.");
        }
    }
}
