package com.example.backend.controller;

import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.dto.dashboard.DashboardStatsResponse;
import com.example.backend.dto.documentation.DocumentationSummaryResponse;
import com.example.backend.dto.question.RecentQuestionResponse;
import com.example.backend.service.RepositoryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final RepositoryService repositoryService;

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsResponse> getStats(Authentication authentication) {
        return ResponseEntity.ok(repositoryService.getDashboardStats(currentUserId(authentication)));
    }

    @GetMapping("/recent-questions")
    public ResponseEntity<List<RecentQuestionResponse>> getRecentQuestions(Authentication authentication) {
        return ResponseEntity.ok(repositoryService.getRecentQuestions(currentUserId(authentication)));
    }

    @GetMapping("/documentation")
    public ResponseEntity<List<DocumentationSummaryResponse>> getDocumentation(Authentication authentication) {
        return ResponseEntity.ok(repositoryService.getDocumentationSummaries(currentUserId(authentication)));
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserProfileResponse principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required.");
        }
        return principal.getId();
    }
}
