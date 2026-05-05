package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.backend.dto.auth.AuthRequest;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.dto.auth.PasswordUpdateRequest;
import com.example.backend.dto.auth.SignupRequest;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import com.example.backend.security.JwtService;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private JwtService jwtService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Mock
    private UserRepository userRepository;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    private AuthService authService;

    @Test
    void signupAddsManualCredentialsToExistingOAuthUser() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        User oauthUser = User.builder()
                .id(12L)
                .email("dev@gmail.com")
                .name("Dev OAuth")
                .username("dev")
                .provider("GOOGLE")
                .roles(Set.of("USER"))
                .build();
        SignupRequest request = signupRequest("dev@gmail.com", "Dev Local", "dev", "secret123");

        when(userRepository.findByEmail("dev@gmail.com")).thenReturn(Optional.of(oauthUser));
        when(userRepository.findByUsername("dev")).thenReturn(Optional.of(oauthUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(12L, "dev@gmail.com")).thenReturn("token");

        AuthResponse response = authService.signup(request);

        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertEquals("token", response.getToken());
        assertEquals("LOCAL", savedUser.getProvider());
        assertEquals("Dev Local", savedUser.getName());
        assertTrue(passwordEncoder.matches("secret123", savedUser.getPasswordHash()));
    }

    @Test
    void loginWorksAfterManualPasswordIsSaved() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        User user = User.builder()
                .id(12L)
                .email("dev@email.com")
                .name("Dev")
                .username("dev")
                .passwordHash(passwordEncoder.encode("secret123"))
                .provider("LOCAL")
                .roles(Set.of("USER"))
                .build();
        AuthRequest request = new AuthRequest();
        request.setEmail("dev@email.com");
        request.setPassword("secret123");

        when(userRepository.findByEmail("dev@email.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(12L, "dev@email.com")).thenReturn("token");

        AuthResponse response = authService.login(request);

        assertEquals("token", response.getToken());
        assertNotNull(response.getUser());
        assertEquals("dev@email.com", response.getUser().getEmail());
    }

    @Test
    void signupRejectsInvalidEmail() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        SignupRequest request = signupRequest("not-an-email", "Dev Local", "dev_user", "secret123");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.signup(request)
        );

        assertEquals("Enter a valid Gmail or Email.com address, for example name@gmail.com or name@email.com.", exception.getReason());
    }

    @Test
    void signupRejectsUnsupportedEmailDomain() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        SignupRequest request = signupRequest("dev@yahoo.com", "Dev Local", "dev_user", "secret123");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.signup(request)
        );

        assertEquals("Enter a valid Gmail or Email.com address, for example name@gmail.com or name@email.com.", exception.getReason());
    }

    @Test
    void signupRejectsWeakPassword() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        SignupRequest request = signupRequest("dev@gmail.com", "Dev Local", "dev_user", "password");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.signup(request)
        );

        assertEquals("Password must include at least one letter and one number. Example: repoai2026.", exception.getReason());
    }

    @Test
    void signupRejectsInvalidUsernameCharacters() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        SignupRequest request = signupRequest("dev@gmail.com", "Dev Local", "dev-user", "secret123");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.signup(request)
        );

        assertEquals("Username must be 3-30 characters and use only letters, numbers, and underscores. Example: dev_user1.", exception.getReason());
    }

    @Test
    void connectOAuthProviderAddsGithubTokenToExistingLocalUser() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        User localUser = User.builder()
                .id(12L)
                .email("dev@gmail.com")
                .name("Dev")
                .username("dev")
                .provider("LOCAL")
                .roles(Set.of("USER"))
                .build();

        when(userRepository.findById(12L)).thenReturn(Optional.of(localUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User connectedUser = authService.connectOAuthProvider(12L, "GITHUB", "github-token");

        assertEquals("LOCAL", connectedUser.getProvider());
        assertEquals("github-token", connectedUser.getGithubOAuthToken());
        verify(userRepository).save(userCaptor.capture());
        assertEquals("dev@gmail.com", userCaptor.getValue().getEmail());
    }

    @Test
    void updatePasswordRequiresCorrectCurrentPasswordForLocalUser() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        User localUser = User.builder()
                .id(12L)
                .email("dev@gmail.com")
                .name("Dev")
                .username("dev")
                .provider("LOCAL")
                .passwordHash(passwordEncoder.encode("oldpass123"))
                .roles(Set.of("USER"))
                .build();
        PasswordUpdateRequest request = new PasswordUpdateRequest();
        request.setCurrentPassword("wrongpass123");
        request.setNewPassword("newpass123");

        when(userRepository.findById(12L)).thenReturn(Optional.of(localUser));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.updatePassword(12L, request)
        );

        assertEquals("Current password is incorrect.", exception.getReason());
    }

    @Test
    void updatePasswordSavesNewPasswordForLocalUser() {
        authService = new AuthService(jwtService, passwordEncoder, userRepository);
        User localUser = User.builder()
                .id(12L)
                .email("dev@gmail.com")
                .name("Dev")
                .username("dev")
                .provider("LOCAL")
                .passwordHash(passwordEncoder.encode("oldpass123"))
                .roles(Set.of("USER"))
                .build();
        PasswordUpdateRequest request = new PasswordUpdateRequest();
        request.setCurrentPassword("oldpass123");
        request.setNewPassword("newpass123");

        when(userRepository.findById(12L)).thenReturn(Optional.of(localUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.updatePassword(12L, request);

        verify(userRepository).save(userCaptor.capture());
        assertTrue(passwordEncoder.matches("newpass123", userCaptor.getValue().getPasswordHash()));
    }

    private SignupRequest signupRequest(String email, String name, String username, String password) {
        SignupRequest request = new SignupRequest();
        request.setEmail(email);
        request.setName(name);
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }
}
