package com.example.backend.controller;

import com.example.backend.dto.dashboard.DashboardStatsResponse;
import com.example.backend.dto.documentation.DocumentationSummaryResponse;
import com.example.backend.dto.question.RecentQuestionResponse;
import com.example.backend.service.RepositoryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final RepositoryService repositoryService;

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsResponse> getStats() {
        return ResponseEntity.ok(repositoryService.getDashboardStats());
    }

    @GetMapping("/recent-questions")
    public ResponseEntity<List<RecentQuestionResponse>> getRecentQuestions() {
        return ResponseEntity.ok(repositoryService.getRecentQuestions());
    }

    @GetMapping("/documentation")
    public ResponseEntity<List<DocumentationSummaryResponse>> getDocumentation() {
        return ResponseEntity.ok(repositoryService.getDocumentationSummaries());
    }
}
