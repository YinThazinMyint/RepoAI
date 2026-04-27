package com.example.backend.controller;

import com.example.backend.dto.RepositoryDTO;
import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.dto.repository.RepositoryDetailResponse;
import com.example.backend.entity.AIQuestion;
import com.example.backend.entity.Documentation;
import com.example.backend.entity.Repository;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.RepositoryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/repositories")
@RequiredArgsConstructor
public class RepositoryController {

    private final RepositoryService repositoryService;
    private final UserRepository userRepository;

    @PostMapping("/upload")
    public ResponseEntity<Repository> uploadRepository(
            @RequestParam(required = false) String githubUrl,
            @RequestParam(required = false) MultipartFile zipFile,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String techStack,
            Authentication authentication
    ) {
        Repository repository = repositoryService.uploadRepository(
                githubUrl,
                zipFile,
                name,
                description,
                language,
                techStack,
                resolveGithubOAuthToken(authentication)
        );
        return ResponseEntity.ok(repository);
    }

    @GetMapping
    public ResponseEntity<List<Repository>> getRepositories() {
        return ResponseEntity.ok(repositoryService.getRepositories());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepositoryDetailResponse> getRepository(@PathVariable Long id) {
        return ResponseEntity.ok(repositoryService.getRepository(id));
    }

    @PostMapping("/{id}/questions")
    public ResponseEntity<AIQuestion> askQuestion(@PathVariable Long id, @RequestBody RepositoryDTO repositoryDTO) {
        return ResponseEntity.ok(repositoryService.askQuestion(id, repositoryDTO.getQuestionText()));
    }

    @PostMapping("/{id}/documentation")
    public ResponseEntity<Documentation> generateDocumentation(
            @PathVariable Long id,
            @RequestBody RepositoryDTO repositoryDTO
    ) {
        return ResponseEntity.ok(repositoryService.generateDocumentation(id, repositoryDTO.getDocumentationType()));
    }

    private String resolveGithubOAuthToken(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserProfileResponse principal)) {
            return null;
        }

        return userRepository.findById(principal.getId())
                .map(User::getGithubOAuthToken)
                .filter(StringUtils::hasText)
                .orElse(null);
    }
}
