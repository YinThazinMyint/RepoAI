package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.backend.dto.auth.AuthRequest;
import com.example.backend.dto.auth.AuthResponse;
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
                .email("dev@example.com")
                .name("Dev OAuth")
                .username("dev")
                .provider("GOOGLE")
                .roles(Set.of("USER"))
                .build();
        SignupRequest request = signupRequest("dev@example.com", "Dev Local", "dev", "secret123");

        when(userRepository.findByEmail("dev@example.com")).thenReturn(Optional.of(oauthUser));
        when(userRepository.findByUsername("dev")).thenReturn(Optional.of(oauthUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(12L, "dev@example.com")).thenReturn("token");

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
                .email("dev@example.com")
                .name("Dev")
                .username("dev")
                .passwordHash(passwordEncoder.encode("secret123"))
                .provider("LOCAL")
                .roles(Set.of("USER"))
                .build();
        AuthRequest request = new AuthRequest();
        request.setEmail("dev@example.com");
        request.setPassword("secret123");

        when(userRepository.findByEmail("dev@example.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(12L, "dev@example.com")).thenReturn("token");

        AuthResponse response = authService.login(request);

        assertEquals("token", response.getToken());
        assertNotNull(response.getUser());
        assertEquals("dev@example.com", response.getUser().getEmail());
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
