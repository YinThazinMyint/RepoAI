package com.example.backend.controller;

import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.dto.github.GitHubRepositoryResponse;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.GitHubService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/integrations/github")
@RequiredArgsConstructor
public class GitHubController {

    private final GitHubService gitHubService;
    private final UserRepository userRepository;

    @GetMapping("/repositories")
    public ResponseEntity<List<GitHubRepositoryResponse>> getRepositories(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserProfileResponse principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "You must be logged in first.");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        return ResponseEntity.ok(gitHubService.getRepositories(user));
    }
}
