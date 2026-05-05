package com.example.backend.service;

import com.example.backend.dto.auth.AuthRequest;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.dto.auth.PasswordUpdateRequest;
import com.example.backend.dto.auth.SignupRequest;
import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import com.example.backend.security.JwtService;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@(gmail\\.com|email\\.com)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]{3,30}$");
    private static final int MAX_EMAIL_LENGTH = 254;
    private static final int MAX_NAME_LENGTH = 80;
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MAX_PASSWORD_LENGTH = 72;

    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    public AuthResponse signup(SignupRequest request) {
        validateSignup(request);

        String email = normalizeEmail(request.getEmail());
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
        if (request == null || !StringUtils.hasText(request.getEmail()) || !StringUtils.hasText(request.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required. Use a Gmail or Email.com address, for example name@gmail.com.");
        }

        String email = normalizeEmail(request.getEmail());
        if (!isValidEmail(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid Gmail or Email.com address, for example name@gmail.com or name@email.com.");
        }

        User user = userRepository.findByEmail(email)
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

    public UserProfileResponse updatePassword(Long userId, PasswordUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        if (request == null || !StringUtils.hasText(request.getNewPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password is required.");
        }

        validatePassword(request.getNewPassword());

        if (StringUtils.hasText(user.getPasswordHash())) {
            if (!StringUtils.hasText(request.getCurrentPassword())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is required.");
            }
            if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
            }
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setProvider(StringUtils.hasText(user.getProvider()) ? user.getProvider() : "LOCAL");
        return UserProfileResponse.from(userRepository.save(user));
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

    public User connectOAuthProvider(Long userId, String provider, String oauthToken) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required."));
        applyOAuthToken(user, provider, oauthToken);
        return userRepository.save(user);
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
        if (request == null
                || !StringUtils.hasText(request.getEmail())
                || !StringUtils.hasText(request.getName())
                || !StringUtils.hasText(request.getUsername())
                || !StringUtils.hasText(request.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name, username, email, and password are required.");
        }

        String email = normalizeEmail(request.getEmail());
        String name = request.getName().trim();
        String username = request.getUsername().trim();
        String password = request.getPassword();

        if (!isValidEmail(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid Gmail or Email.com address, for example name@gmail.com or name@email.com.");
        }
        if (email.length() > MAX_EMAIL_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email must be 254 characters or fewer.");
        }
        if (name.length() < 2 || name.length() > MAX_NAME_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name must be between 2 and 80 characters.");
        }
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must be 3-30 characters and use only letters, numbers, and underscores. Example: dev_user1.");
        }
        validatePassword(password);
    }

    private void validatePassword(String password) {
        if (password.length() < MIN_PASSWORD_LENGTH || password.length() > MAX_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be between 8 and 72 characters.");
        }
        if (!password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must include at least one letter and one number. Example: repoai2026.");
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private boolean isValidEmail(String email) {
        return StringUtils.hasText(email) && EMAIL_PATTERN.matcher(email).matches();
    }
}
