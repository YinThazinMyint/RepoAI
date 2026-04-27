package com.example.backend.service;

import com.example.backend.dto.RepositoryDTO;
import com.example.backend.dto.dashboard.DashboardStatsResponse;
import com.example.backend.dto.documentation.DocumentationSummaryResponse;
import com.example.backend.dto.question.RecentQuestionResponse;
import com.example.backend.dto.repository.RepositoryDetailResponse;
import com.example.backend.entity.AIQuestion;
import com.example.backend.entity.Diagram;
import com.example.backend.entity.Documentation;
import com.example.backend.entity.Repository;
import com.example.backend.entity.RepositoryStatus;
import com.example.backend.repository.AIQuestionRepository;
import com.example.backend.repository.DiagramRepository;
import com.example.backend.repository.DocumentationRepository;
import com.example.backend.repository.RepositoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@RequiredArgsConstructor
public class RepositoryService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int MAX_INDEXED_FILES = 120;
    private static final int MAX_INDEXED_FILE_BYTES = 200_000;

    private final RepositoryRepository repositoryRepository;
    private final DocumentationRepository documentationRepository;
    private final DiagramRepository diagramRepository;
    private final AIQuestionRepository aiQuestionRepository;
    private final OpenAiService openAiService;
    private final RepositoryChunkService repositoryChunkService;

    @Value("${github.api.base-url:https://api.github.com}")
    private String githubApiBaseUrl;

    @Value("${github.api.token:}")
    private String githubApiToken;

    public void uploadRepository(RepositoryDTO repositoryDTO) {
        if (repositoryDTO == null) {
            throw new IllegalArgumentException("Repository payload is required.");
        }

        if (StringUtils.hasText(repositoryDTO.getGithubUrl())) {
            storeGithubRepository(repositoryDTO);
            return;
        }

        if (StringUtils.hasText(repositoryDTO.getZipFile())) {
            storeZipRepository(repositoryDTO);
            return;
        }

        throw new IllegalArgumentException("Either a GitHub URL or ZIP file content must be provided.");
    }

    public Repository uploadRepository(
            String githubUrl,
            MultipartFile zipFile,
            String name,
            String description,
            String language,
            String techStack
    ) {
        return uploadRepository(githubUrl, zipFile, name, description, language, techStack, null);
    }

    public Repository uploadRepository(
            String githubUrl,
            MultipartFile zipFile,
            String name,
            String description,
            String language,
            String techStack,
            String githubOAuthToken
    ) {
        RepositoryDTO repositoryDTO = RepositoryDTO.builder()
                .githubUrl(githubUrl)
                .name(name)
                .description(description)
                .language(language)
                .techStack(techStack)
                .build();

        if (StringUtils.hasText(githubUrl)) {
            return storeGithubRepository(repositoryDTO, githubOAuthToken);
        }

        if (zipFile != null && !zipFile.isEmpty()) {
            return storeZipRepository(repositoryDTO, zipFile);
        }

        throw new IllegalArgumentException("Either a GitHub URL or ZIP file must be provided.");
    }

    public List<Repository> getRepositories() {
        return repositoryRepository.findAllByOrderByCreatedAtDesc();
    }

    public DashboardStatsResponse getDashboardStats() {
        return DashboardStatsResponse.builder()
                .repositories(repositoryRepository.count())
                .questions(aiQuestionRepository.count())
                .docs(documentationRepository.count())
                .diagrams(diagramRepository.count())
                .build();
    }

    public List<DocumentationSummaryResponse> getDocumentationSummaries() {
        Map<Long, Repository> repositoriesById = repositoryRepository.findAll().stream()
                .collect(Collectors.toMap(Repository::getId, Function.identity()));

        return documentationRepository.findAllByOrderByUpdatedAtDesc().stream()
                .map(documentation -> DocumentationSummaryResponse.builder()
                        .id(documentation.getId())
                        .repositoryId(documentation.getRepositoryId())
                        .repositoryName(resolveRepositoryName(repositoriesById, documentation.getRepositoryId()))
                        .title(documentation.getTitle())
                        .content(documentation.getContent())
                        .updatedAt(documentation.getUpdatedAt())
                        .build())
                .toList();
    }

    public List<RecentQuestionResponse> getRecentQuestions() {
        Map<Long, Repository> repositoriesById = repositoryRepository.findAll().stream()
                .collect(Collectors.toMap(Repository::getId, Function.identity()));

        return aiQuestionRepository.findTop10ByOrderByRespondedAtDesc().stream()
                .map(question -> RecentQuestionResponse.builder()
                        .id(question.getId())
                        .repositoryId(question.getRepositoryId())
                        .repositoryName(resolveRepositoryName(repositoriesById, question.getRepositoryId()))
                        .questionText(question.getQuestionText())
                        .answerText(question.getAnswerText())
                        .respondedAt(question.getRespondedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public RepositoryDetailResponse getRepository(Long id) {
        return repositoryRepository.findById(id)
                .map(repository -> RepositoryDetailResponse.builder()
                        .repository(repository)
                        .docs(documentationRepository.findByRepositoryIdOrderByUpdatedAtDesc(id))
                        .diagrams(diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(id))
                        .questions(aiQuestionRepository.findByRepositoryIdOrderByRespondedAtDesc(id))
                        .build())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));
    }

    @Transactional
    public AIQuestion askQuestion(Long repositoryId, String questionText) {
        Repository repository = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));

        ensureRepositoryHasRagContext(repository);
        List<RepositoryChunkService.RetrievedChunk> retrievedChunks =
                repositoryChunkService.findRelevantChunks(repositoryId, questionText);
        String answerText = generateQuestionAnswer(repository, retrievedChunks, questionText);

        AIQuestion question = AIQuestion.builder()
                .repositoryId(repositoryId)
                .questionText(questionText)
                .answerText(answerText)
                .askedAt(Instant.now())
                .respondedAt(Instant.now())
                .build();

        return aiQuestionRepository.save(question);
    }

    @Transactional
    public Documentation generateDocumentation(Long repositoryId, String documentationType) {
        Repository repository = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));

        String title = normalizeDocumentationTitle(documentationType);
        String content = generateDocumentationMarkdown(repository, title);

        Documentation documentation = Documentation.builder()
                .repositoryId(repositoryId)
                .title(title)
                .content(content)
                .build();
        Documentation savedDocumentation = documentationRepository.save(documentation);
        return savedDocumentation;
    }

    private Repository storeGithubRepository(RepositoryDTO repositoryDTO) {
        return storeGithubRepository(repositoryDTO, null);
    }

    private Repository storeGithubRepository(RepositoryDTO repositoryDTO, String githubOAuthToken) {
        JsonNode response = StringUtils.hasText(githubOAuthToken)
                ? fetchGithubRepositoryMetadata(repositoryDTO.getGithubUrl(), githubOAuthToken)
                : fetchGithubRepositoryMetadata(repositoryDTO.getGithubUrl());

        Repository repository = Repository.builder()
                .name(textOrFallback(response, "name", repositoryDTO.getName()))
                .githubUrl(repositoryDTO.getGithubUrl())
                .description(textOrFallback(response, "description", repositoryDTO.getDescription()))
                .language(textOrFallback(response, "language", repositoryDTO.getLanguage()))
                .techStack(resolveTechStack(response, repositoryDTO.getTechStack()))
                .status(RepositoryStatus.READY)
                .build();

        Repository savedRepository = repositoryRepository.save(repository);
        generateOverviewArtifacts(savedRepository, "GitHub URL");
        if (openAiService.isConfigured()) {
            indexGithubRepositoryFiles(savedRepository, repositoryDTO.getGithubUrl(), response, githubOAuthToken);
        }
        return savedRepository;
    }

    JsonNode fetchGithubRepositoryMetadata(String githubUrl) {
        return fetchGithubRepositoryMetadata(githubUrl, null);
    }

    JsonNode fetchGithubRepositoryMetadata(String githubUrl, String githubOAuthToken) {
        String[] repositoryPath = extractOwnerAndRepository(githubUrl);
        RestClient restClient = RestClient.builder()
                .baseUrl(githubApiBaseUrl)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();

        String responseBody = restClient.get()
                .uri("/repos/{owner}/{repo}", repositoryPath[0], repositoryPath[1])
                .headers(headers -> {
                    if (StringUtils.hasText(githubOAuthToken)) {
                        headers.setBearerAuth(githubOAuthToken);
                    } else if (StringUtils.hasText(githubApiToken)) {
                        headers.setBearerAuth(githubApiToken);
                    }
                })
                .retrieve()
                .body(String.class);

        try {
            return OBJECT_MAPPER.readTree(responseBody);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to parse GitHub repository metadata.", exception);
        }
    }

    private void indexGithubRepositoryFiles(
            Repository repository,
            String githubUrl,
            JsonNode metadata,
            String githubOAuthToken
    ) {
        try {
            String branch = textOrFallback(metadata, "default_branch", "main");
            byte[] archiveBytes = fetchGithubRepositoryArchive(githubUrl, branch, githubOAuthToken);
            List<RepositorySourceFile> extractedFiles = extractTextFiles(archiveBytes);
            repository.setFileCount(extractedFiles.size());
            repository.setLinesOfCode(countLines(extractedFiles));
            Repository updatedRepository = repositoryRepository.save(repository);
            List<RepositorySourceFile> sourceFiles = withRepositoryContext(updatedRepository, extractedFiles);
            repositoryChunkService.indexRepository(repository.getId(), sourceFiles);
        } catch (Exception exception) {
            // Adding a repository should still succeed if GitHub archive indexing is temporarily unavailable.
            repositoryChunkService.indexRepository(repository.getId(), withRepositoryContext(repository, List.of()));
        }
    }

    byte[] fetchGithubRepositoryArchive(String githubUrl, String branch, String githubOAuthToken) {
        String[] repositoryPath = extractOwnerAndRepository(githubUrl);
        RestClient restClient = RestClient.builder()
                .baseUrl(githubApiBaseUrl)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .build();

        return restClient.get()
                .uri("/repos/{owner}/{repo}/zipball/{branch}", repositoryPath[0], repositoryPath[1], branch)
                .headers(headers -> {
                    if (StringUtils.hasText(githubOAuthToken)) {
                        headers.setBearerAuth(githubOAuthToken);
                    } else if (StringUtils.hasText(githubApiToken)) {
                        headers.setBearerAuth(githubApiToken);
                    }
                })
                .retrieve()
                .body(byte[].class);
    }

    private Repository storeZipRepository(RepositoryDTO repositoryDTO) {
        byte[] zipBytes = Base64.getDecoder().decode(repositoryDTO.getZipFile());
        ZipMetadata zipMetadata = parseZipMetadata(zipBytes, repositoryDTO.getName());
        List<RepositorySourceFile> sourceFiles = extractTextFiles(zipBytes);

        Repository repository = Repository.builder()
                .name(firstNonBlank(repositoryDTO.getName(), zipMetadata.repositoryName(), "uploaded-repository"))
                .githubUrl(repositoryDTO.getGithubUrl())
                .description(repositoryDTO.getDescription())
                .language(firstNonBlank(repositoryDTO.getLanguage(), zipMetadata.language()))
                .techStack(firstNonBlank(repositoryDTO.getTechStack(), zipMetadata.techStack()))
                .fileCount(sourceFiles.size())
                .linesOfCode(countLines(sourceFiles))
                .status(RepositoryStatus.READY)
                .build();

        Repository savedRepository = repositoryRepository.save(repository);
        generateOverviewArtifacts(savedRepository, "ZIP Upload");
        repositoryChunkService.indexRepository(savedRepository.getId(), withRepositoryContext(savedRepository, sourceFiles));
        return savedRepository;
    }

    private Repository storeZipRepository(RepositoryDTO repositoryDTO, MultipartFile zipFile) {
        String originalFilename = zipFile.getOriginalFilename();
        if (StringUtils.hasText(originalFilename) && !originalFilename.toLowerCase(Locale.ROOT).endsWith(".zip")) {
            throw new IllegalArgumentException("Only .zip repository archives are supported.");
        }

        ZipMetadata zipMetadata;
        List<RepositorySourceFile> sourceFiles;
        try {
            byte[] zipBytes = zipFile.getBytes();
            zipMetadata = parseZipMetadata(zipBytes, repositoryDTO.getName());
            sourceFiles = extractTextFiles(zipBytes);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read uploaded ZIP file.", exception);
        }

        Repository repository = Repository.builder()
                .name(firstNonBlank(repositoryDTO.getName(), zipMetadata.repositoryName(), "uploaded-repository"))
                .githubUrl(repositoryDTO.getGithubUrl())
                .description(repositoryDTO.getDescription())
                .language(firstNonBlank(repositoryDTO.getLanguage(), zipMetadata.language()))
                .techStack(firstNonBlank(repositoryDTO.getTechStack(), zipMetadata.techStack()))
                .fileCount(sourceFiles.size())
                .linesOfCode(countLines(sourceFiles))
                .status(RepositoryStatus.READY)
                .build();

        Repository savedRepository = repositoryRepository.save(repository);
        generateOverviewArtifacts(savedRepository, "ZIP Upload");
        repositoryChunkService.indexRepository(savedRepository.getId(), withRepositoryContext(savedRepository, sourceFiles));
        return savedRepository;
    }

    private void generateOverviewArtifacts(Repository repository, String sourceType) {
        Documentation overviewDoc = Documentation.builder()
                .repositoryId(repository.getId())
                .title("Codebase Overview")
                .content(generateOverviewMarkdown(repository, sourceType))
                .build();
        documentationRepository.save(overviewDoc);

        Diagram flowDiagram = Diagram.builder()
                .repositoryId(repository.getId())
                .title("Repository Flow")
                .mermaidCode(generateFlowDiagram(repository, sourceType))
                .build();
        diagramRepository.save(flowDiagram);

        AIQuestion seededQuestion = AIQuestion.builder()
                .repositoryId(repository.getId())
                .questionText("What is the high-level purpose of this repository?")
                .answerText(generateOverviewAnswer(repository, sourceType))
                .askedAt(Instant.now())
                .respondedAt(Instant.now())
                .build();
        aiQuestionRepository.save(seededQuestion);
    }

    private String generateOverviewMarkdown(Repository repository, String sourceType) {
        String fallback = buildOverviewMarkdown(repository, sourceType);
        if (!openAiService.isConfigured()) {
            return fallback;
        }

        try {
            return openAiService.generateText(
                    "You generate concise repository overview markdown for software projects. Return markdown only.",
                    """
                            Repository name: %s
                            Source type: %s
                            Source reference: %s
                            Primary language: %s
                            Detected tech stack: %s
                            Current status: %s

                            Write a concise overview with sections:
                            - Overview
                            - Main stack
                            - Expected flow
                            - Suggested next analysis steps
                            """.formatted(
                            repository.getName(),
                            sourceType,
                            firstNonBlank(repository.getGithubUrl(), "Uploaded ZIP archive"),
                            firstNonBlank(repository.getLanguage(), "Unknown"),
                            firstNonBlank(repository.getTechStack(), "Unknown"),
                            repository.getStatus()
                    )
            );
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String generateFlowDiagram(Repository repository, String sourceType) {
        String fallback = buildFlowDiagram(repository, sourceType);
        if (!openAiService.isConfigured()) {
            return fallback;
        }

        try {
            return openAiService.generateText(
                    "You generate Mermaid flowchart diagrams only. Return valid Mermaid code only.",
                    """
                            Repository name: %s
                            Source type: %s
                            Primary language: %s
                            Detected tech stack: %s

                            Create a simple high-level repository processing flow from import to analysis readiness.
                            """.formatted(
                            repository.getName(),
                            sourceType,
                            firstNonBlank(repository.getLanguage(), "Unknown"),
                            firstNonBlank(repository.getTechStack(), "Unknown")
                    )
            );
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String generateOverviewAnswer(Repository repository, String sourceType) {
        String fallback = buildOverviewAnswer(repository, sourceType);
        if (!openAiService.isConfigured()) {
            return fallback;
        }

        try {
            return openAiService.generateText(
                    "You answer repository onboarding questions briefly and clearly.",
                    """
                            Question: What is the high-level purpose of this repository?

                            Repository name: %s
                            Source type: %s
                            Primary language: %s
                            Detected tech stack: %s
                            Current status: %s
                            """.formatted(
                            repository.getName(),
                            sourceType,
                            firstNonBlank(repository.getLanguage(), "Unknown"),
                            firstNonBlank(repository.getTechStack(), "Unknown"),
                            repository.getStatus()
                    )
            );
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String generateQuestionAnswer(
            Repository repository,
            List<RepositoryChunkService.RetrievedChunk> retrievedChunks,
            String questionText
    ) {
        String codeContext = retrievedChunks.stream()
                .map(chunk -> """
                        File: %s (chunk %d, score %.3f)
                        %s
                        """.formatted(
                        chunk.filePath(),
                        chunk.chunkIndex(),
                        chunk.score(),
                        chunk.content()
                ))
                .collect(Collectors.joining("\n---\n"));

        String fallback = "I could not find relevant information in the repository.";

        if (!StringUtils.hasText(codeContext)) {
            return fallback;
        }

        if (!openAiService.isConfigured()) {
            return fallback;
        }

        try {
            return openAiService.generateText(
                    """
                            You are an AI assistant designed to help developers understand a codebase.

                            Your task is to answer questions based ONLY on the provided context from the repository.

                            Instructions:
                            * Explain the code clearly and simply
                            * Focus only on the given context
                            * Do NOT make up information
                            * If the answer is not in the context, say: "I could not find relevant information in the repository."
                            * Reference file names or functions if possible
                            * Keep the answer structured and easy to read
                            """,
                    """
                            Repository name: %s

                            Context:
                            %s

                            User question:
                            %s

                            Answer:
                            """.formatted(
                            repository.getName(),
                            codeContext,
                            questionText
                    )
            );
        } catch (Exception exception) {
            throw new IllegalStateException("OpenAI answer generation failed. Check the model, provider, and account quota.", exception);
        }
    }

    private void ensureRepositoryHasRagContext(Repository repository) {
        int indexedChunks = repositoryChunkService.countIndexedChunks(repository.getId());
        if (indexedChunks > 1) {
            return;
        }

        repositoryChunkService.indexRepository(
                repository.getId(),
                withRepositoryContext(repository, List.of())
        );
    }

    private List<RepositorySourceFile> withRepositoryContext(
            Repository repository,
            List<RepositorySourceFile> sourceFiles
    ) {
        List<RepositorySourceFile> files = new ArrayList<>();
        files.add(buildRepositoryMetadataFile(repository));
        files.addAll(buildGeneratedArtifactFiles(repository));
        if (sourceFiles != null) {
            files.addAll(sourceFiles);
        }
        return files;
    }

    private List<RepositorySourceFile> buildGeneratedArtifactFiles(Repository repository) {
        List<RepositorySourceFile> files = new ArrayList<>();
        documentationRepository.findByRepositoryIdOrderByUpdatedAtDesc(repository.getId())
                .forEach(documentation -> files.add(new RepositorySourceFile(
                        "generated-docs/%s.md".formatted(slugify(documentation.getTitle())),
                        documentation.getContent()
                )));
        diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(repository.getId())
                .forEach(diagram -> files.add(new RepositorySourceFile(
                        "generated-diagrams/%s.mmd".formatted(slugify(diagram.getTitle())),
                        """
                                Diagram title: %s

                                Mermaid code:
                                %s
                                """.formatted(diagram.getTitle(), diagram.getMermaidCode())
                )));
        return files;
    }

    private RepositorySourceFile buildRepositoryMetadataFile(Repository repository) {
        return new RepositorySourceFile(
                "repository-metadata.md",
                """
                        # Repository Metadata

                        Repository name: %s
                        Description: %s
                        GitHub URL: %s
                        Primary language: %s
                        Detected technologies / tech stack: %s
                        Scanned file count: %s
                        Scanned lines of code: %s
                        Status: %s
                        Added at: %s
                        Updated at: %s
                        """.formatted(
                        firstNonBlank(repository.getName(), "Unknown"),
                        firstNonBlank(repository.getDescription(), "No description provided"),
                        firstNonBlank(repository.getGithubUrl(), "Uploaded ZIP archive"),
                        firstNonBlank(repository.getLanguage(), "Unknown"),
                        firstNonBlank(repository.getTechStack(), "Unknown"),
                        repository.getFileCount() != null ? repository.getFileCount() : "Unknown",
                        repository.getLinesOfCode() != null ? repository.getLinesOfCode() : "Unknown",
                        repository.getStatus(),
                        repository.getCreatedAt(),
                        repository.getUpdatedAt()
                )
        );
    }

    private long countLines(List<RepositorySourceFile> sourceFiles) {
        if (sourceFiles == null) {
            return 0;
        }

        return sourceFiles.stream()
                .map(RepositorySourceFile::content)
                .filter(StringUtils::hasText)
                .mapToLong(content -> content.lines().count())
                .sum();
    }

    private String slugify(String value) {
        if (!StringUtils.hasText(value)) {
            return "untitled";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private String buildOverviewMarkdown(Repository repository, String sourceType) {
        String language = firstNonBlank(repository.getLanguage(), "Unknown");
        String techStack = firstNonBlank(repository.getTechStack(), "Not detected yet");
        String sourceReference = firstNonBlank(repository.getGithubUrl(), "Uploaded ZIP archive");

        return """
                # Overview

                ## Repository
                - Name: %s
                - Source type: %s
                - Source reference: %s
                - Primary language: %s
                - Detected stack: %s
                - Current status: %s

                ## Flow
                1. The repository is uploaded or connected from GitHub.
                2. RepoAI extracts top-level metadata such as language and stack.
                3. Documentation and diagrams are generated for quick orientation.
                4. The repository becomes ready for further Q&A and analysis.

                ## Notes
                This overview is an initial generated summary and can be expanded with deeper scanning later.
                """.formatted(
                repository.getName(),
                sourceType,
                sourceReference,
                language,
                techStack,
                repository.getStatus()
        );
    }

    private String buildFlowDiagram(Repository repository, String sourceType) {
        return """
                flowchart TD
                    A[%s] --> B[Metadata Extraction]
                    B --> C[Language: %s]
                    B --> D[Tech Stack: %s]
                    C --> E[Generate Overview]
                    D --> E
                    E --> F[Generate Flow Diagram]
                    F --> G[Repository Ready]
                """.formatted(
                sourceType,
                firstNonBlank(repository.getLanguage(), "Unknown"),
                firstNonBlank(repository.getTechStack(), "Pending")
        );
    }

    private String buildOverviewAnswer(Repository repository, String sourceType) {
        return """
                This repository was added via %s. RepoAI identified `%s` as the primary language and `%s` as the main detected stack. An overview document and a flow diagram were generated to help with quick onboarding.
                """.formatted(
                sourceType,
                firstNonBlank(repository.getLanguage(), "Unknown language"),
                firstNonBlank(repository.getTechStack(), "an undetermined stack")
        );
    }

    private String normalizeDocumentationTitle(String documentationType) {
        String value = firstNonBlank(documentationType, "Project Overview");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.contains("api")) {
            return "API Documentation";
        }
        if (normalized.contains("module")) {
            return "Module Docs";
        }
        return "Project Overview";
    }

    private String generateDocumentationMarkdown(Repository repository, String title) {
        String fallback = buildDocumentationMarkdown(repository, title);
        if (!openAiService.isConfigured()) {
            return fallback;
        }

        try {
            return openAiService.generateText(
                    """
                            You generate README-style markdown documentation for a code repository.
                            Use only the repository metadata provided. Do not invent endpoints or modules.
                            If details are unknown, say they need deeper source analysis.
                            Return markdown only.
                            """,
                    """
                            Documentation type: %s
                            Repository name: %s
                            Description: %s
                            Primary language: %s
                            Detected tech stack: %s
                            File count: %s
                            Lines of code: %s
                            Source reference: %s

                            Create useful documentation for this type.
                            """.formatted(
                            title,
                            firstNonBlank(repository.getName(), "Unknown"),
                            firstNonBlank(repository.getDescription(), "No description provided"),
                            firstNonBlank(repository.getLanguage(), "Unknown"),
                            firstNonBlank(repository.getTechStack(), "Unknown"),
                            repository.getFileCount() != null ? repository.getFileCount() : "Unknown",
                            repository.getLinesOfCode() != null ? repository.getLinesOfCode() : "Unknown",
                            firstNonBlank(repository.getGithubUrl(), "Uploaded ZIP archive")
                    )
            );
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String buildDocumentationMarkdown(Repository repository, String title) {
        String language = firstNonBlank(repository.getLanguage(), "Unknown");
        String techStack = firstNonBlank(repository.getTechStack(), "Not detected yet");
        String description = firstNonBlank(repository.getDescription(), "No description provided.");

        if ("API Documentation".equals(title)) {
            return """
                    # API Documentation

                    ## Repository
                    %s

                    ## Detected Stack
                    - Language: %s
                    - Technologies: %s

                    ## API Notes
                    No endpoint-level details were detected from the available generated context yet. Re-upload or rescan the repository with backend controller/routes included to generate endpoint-specific documentation.
                    """.formatted(description, language, techStack);
        }

        if ("Module Docs".equals(title)) {
            return """
                    # Module Docs

                    ## Repository
                    %s

                    ## Detected Stack
                    - Language: %s
                    - Technologies: %s

                    ## Modules
                    Module-level details need deeper source analysis. The repository has %s scanned files and %s scanned lines.
                    """.formatted(
                    description,
                    language,
                    techStack,
                    repository.getFileCount() != null ? repository.getFileCount() : "unknown",
                    repository.getLinesOfCode() != null ? repository.getLinesOfCode() : "unknown"
            );
        }

        return buildOverviewMarkdown(repository, "Repository Detail");
    }

    private ZipMetadata parseZipMetadata(byte[] zipBytes, String fallbackName) {
        Set<String> detectedStacks = new LinkedHashSet<>();
        String repositoryName = fallbackName;
        String language = null;
        int entryCount = 0;

        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(zipBytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                entryCount++;
                String entryName = entry.getName();
                if (!StringUtils.hasText(repositoryName) && entryName.contains("/")) {
                    repositoryName = entryName.substring(0, entryName.indexOf('/'));
                }

                String lowercaseName = entryName.toLowerCase(Locale.ROOT);
                if (lowercaseName.endsWith("pom.xml")) {
                    detectedStacks.add("Spring Boot");
                    detectedStacks.add("Maven");
                    language = firstNonBlank(language, "Java");
                } else if (lowercaseName.endsWith("build.gradle") || lowercaseName.endsWith("build.gradle.kts")) {
                    detectedStacks.add("Gradle");
                    language = firstNonBlank(language, "Java");
                } else if (lowercaseName.endsWith("package.json")) {
                    detectedStacks.add("Node.js");
                    language = firstNonBlank(language, "JavaScript");
                } else if (lowercaseName.endsWith("requirements.txt")) {
                    detectedStacks.add("Python");
                    language = firstNonBlank(language, "Python");
                } else if (lowercaseName.endsWith(".java")) {
                    language = firstNonBlank(language, "Java");
                } else if (lowercaseName.endsWith(".ts")) {
                    language = firstNonBlank(language, "TypeScript");
                } else if (lowercaseName.endsWith(".js")) {
                    language = firstNonBlank(language, "JavaScript");
                }
            }
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to parse the uploaded ZIP file.", exception);
        }

        if (entryCount == 0) {
            throw new IllegalArgumentException("Uploaded ZIP file is empty or cannot be read.");
        }

        return new ZipMetadata(repositoryName, language, String.join(", ", detectedStacks));
    }

    private List<RepositorySourceFile> extractTextFiles(byte[] zipBytes) {
        List<RepositorySourceFile> sourceFiles = new ArrayList<>();

        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(zipBytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null && sourceFiles.size() < MAX_INDEXED_FILES) {
                String entryName = entry.getName();
                if (entry.isDirectory() || shouldSkipPath(entryName) || !isLikelyTextFile(entryName)) {
                    continue;
                }

                byte[] bytes = readLimitedEntry(zipInputStream);
                if (bytes.length == 0 || bytes.length > MAX_INDEXED_FILE_BYTES || looksBinary(bytes)) {
                    continue;
                }

                String content = new String(bytes, StandardCharsets.UTF_8);
                if (StringUtils.hasText(content)) {
                    sourceFiles.add(new RepositorySourceFile(stripArchiveRoot(entryName), content));
                }
            }
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to extract text files from ZIP repository.", exception);
        }

        return sourceFiles;
    }

    private byte[] readLimitedEntry(ZipInputStream zipInputStream) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int totalBytes = 0;
        int bytesRead;
        while ((bytesRead = zipInputStream.read(buffer)) != -1) {
            totalBytes += bytesRead;
            if (totalBytes > MAX_INDEXED_FILE_BYTES) {
                return new byte[MAX_INDEXED_FILE_BYTES + 1];
            }
            outputStream.write(buffer, 0, bytesRead);
        }
        return outputStream.toByteArray();
    }

    private boolean shouldSkipPath(String path) {
        String normalizedPath = path.replace("\\", "/").toLowerCase(Locale.ROOT);
        return normalizedPath.contains("/.git/")
                || normalizedPath.contains("/node_modules/")
                || normalizedPath.contains("/target/")
                || normalizedPath.contains("/build/")
                || normalizedPath.contains("/dist/")
                || normalizedPath.contains("/.next/")
                || normalizedPath.contains("/coverage/")
                || normalizedPath.endsWith("package-lock.json")
                || normalizedPath.endsWith("yarn.lock")
                || normalizedPath.endsWith("pnpm-lock.yaml");
    }

    private boolean isLikelyTextFile(String path) {
        String lowercasePath = path.toLowerCase(Locale.ROOT);
        return lowercasePath.endsWith(".java")
                || lowercasePath.endsWith(".kt")
                || lowercasePath.endsWith(".js")
                || lowercasePath.endsWith(".jsx")
                || lowercasePath.endsWith(".ts")
                || lowercasePath.endsWith(".tsx")
                || lowercasePath.endsWith(".py")
                || lowercasePath.endsWith(".go")
                || lowercasePath.endsWith(".cs")
                || lowercasePath.endsWith(".php")
                || lowercasePath.endsWith(".rb")
                || lowercasePath.endsWith(".rs")
                || lowercasePath.endsWith(".sql")
                || lowercasePath.endsWith(".html")
                || lowercasePath.endsWith(".css")
                || lowercasePath.endsWith(".scss")
                || lowercasePath.endsWith(".json")
                || lowercasePath.endsWith(".xml")
                || lowercasePath.endsWith(".yml")
                || lowercasePath.endsWith(".yaml")
                || lowercasePath.endsWith(".properties")
                || lowercasePath.endsWith(".md")
                || lowercasePath.endsWith(".txt")
                || lowercasePath.endsWith("dockerfile")
                || lowercasePath.endsWith("pom.xml")
                || lowercasePath.endsWith("build.gradle")
                || lowercasePath.endsWith("build.gradle.kts")
                || lowercasePath.endsWith("package.json");
    }

    private boolean looksBinary(byte[] bytes) {
        int sampleSize = Math.min(bytes.length, 1024);
        for (int index = 0; index < sampleSize; index++) {
            if (bytes[index] == 0) {
                return true;
            }
        }
        return false;
    }

    private String stripArchiveRoot(String path) {
        String normalizedPath = path.replace("\\", "/");
        int slashIndex = normalizedPath.indexOf('/');
        if (slashIndex < 0 || slashIndex == normalizedPath.length() - 1) {
            return normalizedPath;
        }
        return normalizedPath.substring(slashIndex + 1);
    }

    private String[] extractOwnerAndRepository(String githubUrl) {
        String sanitizedUrl = githubUrl.trim().replaceAll("/+$", "").replace(".git", "");
        String[] segments = sanitizedUrl.split("/");
        if (segments.length < 2) {
            throw new IllegalArgumentException("GitHub URL must include both owner and repository name.");
        }
        return new String[] {segments[segments.length - 2], segments[segments.length - 1]};
    }

    private String resolveTechStack(JsonNode response, String fallbackTechStack) {
        String topicList = null;
        JsonNode topicsNode = response.path("topics");
        if (topicsNode.isArray() && !topicsNode.isEmpty()) {
            Set<String> topicValues = new LinkedHashSet<>();
            topicsNode.forEach(node -> topicValues.add(node.asText()));
            topicList = String.join(", ", topicValues);
        }

        return firstNonBlank(fallbackTechStack, topicList);
    }

    private String textOrFallback(JsonNode response, String fieldName, String fallback) {
        String value = response != null ? response.path(fieldName).asText(null) : null;
        return firstNonBlank(value, fallback);
    }

    private String resolveRepositoryName(Map<Long, Repository> repositoriesById, Long repositoryId) {
        Repository repository = repositoriesById.get(repositoryId);
        return repository != null ? repository.getName() : "Unknown repository";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private record ZipMetadata(String repositoryName, String language, String techStack) {
    }
}
