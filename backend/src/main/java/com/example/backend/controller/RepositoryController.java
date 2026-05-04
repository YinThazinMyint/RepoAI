package com.example.backend.controller;

import com.example.backend.dto.RepositoryDTO;
import com.example.backend.dto.auth.UserProfileResponse;
import com.example.backend.dto.repository.RepositoryDetailResponse;
import com.example.backend.entity.AIQuestion;
import com.example.backend.entity.Diagram;
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
import org.springframework.web.bind.annotation.DeleteMapping;
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
            @RequestParam(defaultValue = "public") String repositoryVisibility,
            Authentication authentication
    ) {
        Repository repository = repositoryService.uploadRepository(
                githubUrl,
                zipFile,
                name,
                description,
                language,
                techStack,
                repositoryVisibility,
                currentUserId(authentication),
                resolveGithubOAuthToken(authentication)
        );
        return ResponseEntity.ok(repository);
    }

    @GetMapping
    public ResponseEntity<List<Repository>> getRepositories(Authentication authentication) {
        return ResponseEntity.ok(repositoryService.getRepositories(currentUserId(authentication)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepositoryDetailResponse> getRepository(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(repositoryService.getRepository(id, currentUserId(authentication)));
    }

    @PostMapping("/{id}/questions")
    public ResponseEntity<AIQuestion> askQuestion(
            @PathVariable Long id,
            @RequestBody RepositoryDTO repositoryDTO,
            Authentication authentication
    ) {
        return ResponseEntity.ok(repositoryService.askQuestion(id, repositoryDTO.getQuestionText(), currentUserId(authentication)));
    }

    @PostMapping("/{id}/documentation")
    public ResponseEntity<Documentation> generateDocumentation(
            @PathVariable Long id,
            @RequestBody RepositoryDTO repositoryDTO,
            Authentication authentication
    ) {
        return ResponseEntity.ok(repositoryService.generateDocumentation(
                id,
                repositoryDTO.getDocumentationType(),
                currentUserId(authentication)
        ));
    }

    @PostMapping("/{id}/diagrams")
    public ResponseEntity<Diagram> generateDiagram(
            @PathVariable Long id,
            @RequestBody RepositoryDTO repositoryDTO,
            Authentication authentication
    ) {
        return ResponseEntity.ok(repositoryService.generateDiagram(id, repositoryDTO.getDiagramType(), currentUserId(authentication)));
    }

    @DeleteMapping("/{id}/documentation/{documentationId}")
    public ResponseEntity<Void> deleteDocumentation(
            @PathVariable Long id,
            @PathVariable Long documentationId,
            Authentication authentication
    ) {
        repositoryService.deleteDocumentation(id, documentationId, currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/diagrams/{diagramId}")
    public ResponseEntity<Void> deleteDiagram(
            @PathVariable Long id,
            @PathVariable Long diagramId,
            Authentication authentication
    ) {
        repositoryService.deleteDiagram(id, diagramId, currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/documentation")
    public ResponseEntity<Void> deleteDocumentationWithRequestBody(
            @PathVariable Long id,
            @RequestBody RepositoryDTO repositoryDTO,
            Authentication authentication
    ) {
        repositoryService.deleteDocumentation(id, repositoryDTO.getDocumentationId(), currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/diagrams")
    public ResponseEntity<Void> deleteDiagramWithRequestBody(
            @PathVariable Long id,
            @RequestBody RepositoryDTO repositoryDTO,
            Authentication authentication
    ) {
        repositoryService.deleteDiagram(id, repositoryDTO.getDiagramId(), currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRepository(@PathVariable Long id, Authentication authentication) {
        repositoryService.deleteRepository(id, currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserProfileResponse principal)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "Login is required."
            );
        }
        return principal.getId();
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
