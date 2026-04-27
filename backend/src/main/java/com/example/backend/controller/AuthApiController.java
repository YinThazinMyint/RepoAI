package com.example.backend.controller;

import com.example.backend.dto.auth.AuthRequest;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.dto.auth.SignupRequest;
import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthApiController {

    private final AuthService authService;

    @PostMapping("/auth/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody SignupRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/user/me")
    public ResponseEntity<UserProfileResponse> currentUser(Authentication authentication) {
        UserProfileResponse user = (UserProfileResponse) authentication.getPrincipal();
        return ResponseEntity.ok(user);
    }
}
