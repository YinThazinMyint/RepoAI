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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@RequiredArgsConstructor
@Slf4j
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
        return uploadRepository(githubUrl, zipFile, name, description, language, techStack, "public", null, null);
    }

    public Repository uploadRepository(
            String githubUrl,
            MultipartFile zipFile,
            String name,
            String description,
            String language,
            String techStack,
            String repositoryVisibility,
            Long ownerUserId,
            String githubOAuthToken
    ) {
        RepositoryDTO repositoryDTO = RepositoryDTO.builder()
                .githubUrl(githubUrl)
                .name(name)
                .description(description)
                .language(language)
                .techStack(techStack)
                .repositoryVisibility(repositoryVisibility)
                .build();

        if (StringUtils.hasText(githubUrl)) {
            return storeGithubRepository(repositoryDTO, ownerUserId, githubOAuthToken);
        }

        if (zipFile != null && !zipFile.isEmpty()) {
            return storeZipRepository(repositoryDTO, zipFile, ownerUserId);
        }

        throw new IllegalArgumentException("Either a GitHub URL or ZIP file must be provided.");
    }

    public List<Repository> getRepositories() {
        return repositoryRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Repository> getRepositories(Long ownerUserId) {
        return repositoryRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId);
    }

    public DashboardStatsResponse getDashboardStats() {
        return DashboardStatsResponse.builder()
                .repositories(repositoryRepository.count())
                .questions(aiQuestionRepository.count())
                .docs(documentationRepository.count())
                .diagrams(diagramRepository.count())
                .build();
    }

    public DashboardStatsResponse getDashboardStats(Long ownerUserId) {
        List<Long> repositoryIds = repositoryIdsForOwner(ownerUserId);
        return DashboardStatsResponse.builder()
                .repositories(repositoryRepository.countByOwnerUserId(ownerUserId))
                .questions(repositoryIds.isEmpty() ? 0 : aiQuestionRepository.countByRepositoryIdIn(repositoryIds))
                .docs(repositoryIds.isEmpty() ? 0 : documentationRepository.countByRepositoryIdIn(repositoryIds))
                .diagrams(repositoryIds.isEmpty() ? 0 : diagramRepository.countByRepositoryIdIn(repositoryIds))
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

    public List<DocumentationSummaryResponse> getDocumentationSummaries(Long ownerUserId) {
        List<Repository> repositories = repositoryRepository.findByOwnerUserId(ownerUserId);
        Map<Long, Repository> repositoriesById = repositories.stream()
                .collect(Collectors.toMap(Repository::getId, Function.identity()));
        List<Long> repositoryIds = new ArrayList<>(repositoriesById.keySet());

        if (repositoryIds.isEmpty()) {
            return List.of();
        }

        return documentationRepository.findByRepositoryIdInOrderByUpdatedAtDesc(repositoryIds).stream()
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

    public List<RecentQuestionResponse> getRecentQuestions(Long ownerUserId) {
        List<Repository> repositories = repositoryRepository.findByOwnerUserId(ownerUserId);
        Map<Long, Repository> repositoriesById = repositories.stream()
                .collect(Collectors.toMap(Repository::getId, Function.identity()));
        List<Long> repositoryIds = new ArrayList<>(repositoriesById.keySet());

        if (repositoryIds.isEmpty()) {
            return List.of();
        }

        return aiQuestionRepository.findTop10ByRepositoryIdInOrderByRespondedAtDesc(repositoryIds).stream()
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
                        .diagrams(displayDiagrams(id))
                        .questions(aiQuestionRepository.findByRepositoryIdOrderByRespondedAtDesc(id))
                        .build())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));
    }

    @Transactional(readOnly = true)
    public RepositoryDetailResponse getRepository(Long id, Long ownerUserId) {
        return repositoryRepository.findByIdAndOwnerUserId(id, ownerUserId)
                .map(repository -> RepositoryDetailResponse.builder()
                        .repository(repository)
                        .docs(documentationRepository.findByRepositoryIdOrderByUpdatedAtDesc(id))
                        .diagrams(displayDiagrams(id))
                        .questions(aiQuestionRepository.findByRepositoryIdOrderByRespondedAtDesc(id))
                        .build())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));
    }

    private List<Diagram> displayDiagrams(Long repositoryId) {
        return diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(repositoryId).stream()
                .map(this::repairDiagramForDisplay)
                .toList();
    }

    private Diagram repairDiagramForDisplay(Diagram diagram) {
        String repairedMermaidCode = repairGenericFlowchartLabels(diagram.getMermaidCode());
        if (repairedMermaidCode.equals(diagram.getMermaidCode())) {
            return diagram;
        }

        return Diagram.builder()
                .id(diagram.getId())
                .repositoryId(diagram.getRepositoryId())
                .title(diagram.getTitle())
                .mermaidCode(repairedMermaidCode)
                .createdAt(diagram.getCreatedAt())
                .updatedAt(diagram.getUpdatedAt())
                .build();
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
    public AIQuestion askQuestion(Long repositoryId, String questionText, Long ownerUserId) {
        requireOwnedRepository(repositoryId, ownerUserId);
        return askQuestion(repositoryId, questionText);
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

    @Transactional
    public Documentation generateDocumentation(Long repositoryId, String documentationType, Long ownerUserId) {
        requireOwnedRepository(repositoryId, ownerUserId);
        return generateDocumentation(repositoryId, documentationType);
    }

    @Transactional
    public Diagram generateDiagram(Long repositoryId, String diagramType) {
        Repository repository = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));

        String baseTitle = normalizeDiagramTitle(diagramType);
        String title = nextDiagramTitle(repositoryId, baseTitle);
        String mermaidCode = generateMermaidDiagram(repository, baseTitle);

        Diagram diagram = Diagram.builder()
                .repositoryId(repositoryId)
                .title(title)
                .mermaidCode(mermaidCode)
                .build();
        return diagramRepository.save(diagram);
    }

    @Transactional
    public Diagram generateDiagram(Long repositoryId, String diagramType, Long ownerUserId) {
        requireOwnedRepository(repositoryId, ownerUserId);
        return generateDiagram(repositoryId, diagramType);
    }

    @Transactional
    public void deleteDocumentation(Long repositoryId, Long documentationId, Long ownerUserId) {
        if (documentationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Documentation id is required.");
        }
        requireOwnedRepository(repositoryId, ownerUserId);
        long deleted = documentationRepository.deleteByIdAndRepositoryId(documentationId, repositoryId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Documentation not found.");
        }
    }

    @Transactional
    public void deleteDiagram(Long repositoryId, Long diagramId, Long ownerUserId) {
        if (diagramId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Diagram id is required.");
        }
        requireOwnedRepository(repositoryId, ownerUserId);
        long deleted = diagramRepository.deleteByIdAndRepositoryId(diagramId, repositoryId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Diagram not found.");
        }
    }

    @Transactional
    public void deleteRepository(Long repositoryId, Long ownerUserId) {
        Repository repository = requireOwnedRepository(repositoryId, ownerUserId);
        repositoryChunkService.deleteRepositoryChunks(repository.getId());
        aiQuestionRepository.deleteByRepositoryId(repository.getId());
        diagramRepository.deleteByRepositoryId(repository.getId());
        documentationRepository.deleteByRepositoryId(repository.getId());
        repositoryRepository.delete(repository);
    }

    private Repository storeGithubRepository(RepositoryDTO repositoryDTO) {
        return storeGithubRepository(repositoryDTO, null);
    }

    private Repository storeGithubRepository(RepositoryDTO repositoryDTO, String githubOAuthToken) {
        return storeGithubRepository(repositoryDTO, null, githubOAuthToken);
    }

    private Repository storeGithubRepository(RepositoryDTO repositoryDTO, Long ownerUserId, String githubOAuthToken) {
        boolean privateImport = "private".equalsIgnoreCase(repositoryDTO.getRepositoryVisibility());
        if (privateImport && !StringUtils.hasText(githubOAuthToken)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Private repositories require GitHub connection."
            );
        }

        JsonNode response = fetchRepositoryMetadataForImport(repositoryDTO, privateImport, githubOAuthToken);

        Repository repository = Repository.builder()
                .name(textOrFallback(response, "name", repositoryDTO.getName()))
                .githubUrl(repositoryDTO.getGithubUrl())
                .description(textOrFallback(response, "description", repositoryDTO.getDescription()))
                .language(textOrFallback(response, "language", repositoryDTO.getLanguage()))
                .techStack(resolveTechStack(response, repositoryDTO.getTechStack()))
                .ownerUserId(ownerUserId)
                .status(RepositoryStatus.ANALYZING)
                .build();

        Repository savedRepository = repositoryRepository.save(repository);
        generateOverviewArtifacts(savedRepository, "GitHub URL");
        return indexGithubRepositoryFiles(
                savedRepository,
                repositoryDTO.getGithubUrl(),
                response,
                privateImport ? githubOAuthToken : null
        );
    }

    private JsonNode fetchRepositoryMetadataForImport(
            RepositoryDTO repositoryDTO,
            boolean privateImport,
            String githubOAuthToken
    ) {
        if (privateImport) {
            return fetchGithubRepositoryMetadata(repositoryDTO.getGithubUrl(), githubOAuthToken);
        }

        try {
            return fetchGithubRepositoryMetadata(repositoryDTO.getGithubUrl());
        } catch (Exception exception) {
            log.warn(
                    "GitHub metadata validation failed for public URL {}; falling back to archive scan: {}",
                    repositoryDTO.getGithubUrl(),
                    exception.getMessage()
            );
            return buildFallbackGithubMetadata(repositoryDTO.getGithubUrl(), repositoryDTO);
        }
    }

    private JsonNode buildFallbackGithubMetadata(String githubUrl, RepositoryDTO repositoryDTO) {
        String[] repositoryPath = extractOwnerAndRepository(githubUrl);
        com.fasterxml.jackson.databind.node.ObjectNode fallback = OBJECT_MAPPER.createObjectNode();
        fallback.put("name", firstNonBlank(repositoryDTO.getName(), repositoryPath[1]));
        fallback.put("description", repositoryDTO.getDescription());
        fallback.put("language", repositoryDTO.getLanguage());
        fallback.put("default_branch", "main");
        fallback.put("private", false);
        return fallback;
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

    private Repository indexGithubRepositoryFiles(
            Repository repository,
            String githubUrl,
            JsonNode metadata,
            String githubOAuthToken
    ) {
        try {
            String branch = textOrFallback(metadata, "default_branch", "main");
            List<RepositorySourceFile> extractedFiles = loadGithubSourceFiles(githubUrl, branch, githubOAuthToken);
            repository.setFileCount(extractedFiles.size());
            repository.setLinesOfCode(countLines(extractedFiles));
            repository.setStatus(RepositoryStatus.READY);
            Repository updatedRepository = repositoryRepository.save(repository);
            List<RepositorySourceFile> sourceFiles = withRepositoryContext(updatedRepository, extractedFiles);
            repositoryChunkService.indexRepository(repository.getId(), sourceFiles);
            return updatedRepository;
        } catch (Exception exception) {
            log.warn(
                    "Repository {} file scan failed for GitHub URL {}: {}",
                    repository.getId(),
                    githubUrl,
                    exception.getMessage(),
                    exception
            );
            repository.setStatus(RepositoryStatus.ERROR);
            repositoryRepository.save(repository);
            repositoryChunkService.indexRepository(repository.getId(), withRepositoryContext(repository, List.of()));
            throw buildGithubScanException(exception);
        }
    }

    private List<RepositorySourceFile> loadGithubSourceFiles(
            String githubUrl,
            String branch,
            String githubOAuthToken
    ) {
        try {
            byte[] archiveBytes = fetchGithubRepositoryArchive(githubUrl, branch, githubOAuthToken);
            if (archiveBytes == null || archiveBytes.length == 0) {
                throw new IllegalStateException("GitHub archive download returned an empty response.");
            }
            return extractTextFiles(archiveBytes);
        } catch (Exception archiveException) {
            log.info(
                    "GitHub archive download failed for {}; retrying with git clone fallback: {}",
                    githubUrl,
                    archiveException.getMessage()
            );
            return cloneAndScanGithubRepository(githubUrl, githubOAuthToken);
        }
    }

    private RuntimeException buildGithubScanException(Exception exception) {
        if (exception instanceof IllegalStateException) {
            return new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Repository files could not be downloaded from GitHub. Please check that the public URL is correct and try again."
            );
        }

        if (exception instanceof RestClientResponseException responseException) {
            HttpStatus status = HttpStatus.resolve(responseException.getStatusCode().value());
            if (status == HttpStatus.NOT_FOUND || status == HttpStatus.FORBIDDEN || status == HttpStatus.UNAUTHORIZED) {
                return new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "This repository could not be scanned anonymously. If it is private, connect your GitHub account and import it again."
                );
            }
            if (status == HttpStatus.TOO_MANY_REQUESTS) {
                return new ResponseStatusException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "GitHub rate limit reached while scanning this public repository. Try again later."
                );
            }
        }

        return new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Repository files could not be downloaded from GitHub. Please check that the public URL is correct and try again."
        );
    }

    byte[] fetchGithubRepositoryArchive(String githubUrl, String branch, String githubOAuthToken) {
        String[] repositoryPath = extractOwnerAndRepository(githubUrl);
        try {
            return fetchPublicGithubArchiveWithBranchFallback(repositoryPath[0], repositoryPath[1], branch);
        } catch (RestClientResponseException publicArchiveException) {
            if (!StringUtils.hasText(githubOAuthToken)) {
                throw publicArchiveException;
            }

            log.info(
                    "Public GitHub archive download failed for {}/{} on branch {}; retrying with connected GitHub token.",
                    repositoryPath[0],
                    repositoryPath[1],
                    branch
            );
            byte[] authenticatedArchive =
                    fetchAuthenticatedGithubArchive(repositoryPath[0], repositoryPath[1], branch, githubOAuthToken);
            if (authenticatedArchive == null || authenticatedArchive.length == 0) {
                throw new IllegalStateException("Authenticated GitHub archive download returned an empty response.");
            }
            return authenticatedArchive;
        }
    }

    private byte[] fetchPublicGithubArchiveWithBranchFallback(String owner, String repositoryName, String branch) {
        List<String> branchCandidates = new ArrayList<>();
        if (StringUtils.hasText(branch)) {
            branchCandidates.add(branch);
        }
        branchCandidates.add("main");
        branchCandidates.add("master");

        RestClientResponseException lastException = null;
        for (String candidateBranch : branchCandidates.stream().distinct().toList()) {
            try {
                return fetchPublicGithubArchive(owner, repositoryName, candidateBranch);
            } catch (RestClientResponseException exception) {
                lastException = exception;
            }
        }

        throw lastException != null
                ? lastException
                : new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub archive could not be downloaded.");
    }

    private byte[] fetchPublicGithubArchive(String owner, String repositoryName, String branch) {
        RestClient restClient = RestClient.builder()
                .baseUrl("https://codeload.github.com")
                .defaultHeader(HttpHeaders.ACCEPT, "application/zip")
                .defaultHeader(HttpHeaders.USER_AGENT, "RepoAI")
                .build();

        byte[] archive = restClient.get()
                .uri("/repos/{owner}/{repo}/zip/refs/heads/{branch}", owner, repositoryName, branch)
                .retrieve()
                .body(byte[].class);
        if (archive == null || archive.length == 0) {
            throw new IllegalStateException("Public GitHub archive download returned an empty response.");
        }
        return archive;
    }

    private byte[] fetchAuthenticatedGithubArchive(
            String owner,
            String repositoryName,
            String branch,
            String githubOAuthToken
    ) {
        RestClient restClient = RestClient.builder()
                .baseUrl(githubApiBaseUrl)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader(HttpHeaders.USER_AGENT, "RepoAI")
                .build();

        return restClient.get()
                .uri("/repos/{owner}/{repo}/zipball/{branch}", owner, repositoryName, branch)
                .headers(headers -> headers.setBearerAuth(githubOAuthToken))
                .retrieve()
                .body(byte[].class);
    }

    private List<RepositorySourceFile> cloneAndScanGithubRepository(String githubUrl, String githubOAuthToken) {
        Path clonePath = Path.of(System.getProperty("java.io.tmpdir"), "repoai", "repos", UUID.randomUUID().toString());
        try {
            Files.createDirectories(clonePath.getParent());
            runGitClone(normalizeGitCloneUrl(githubUrl, githubOAuthToken), clonePath);
            return scanLocalRepositoryFiles(clonePath);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Repository could not be cloned from GitHub.", exception);
        } finally {
            deleteDirectoryQuietly(clonePath);
        }
    }

    private void runGitClone(String cloneUrl, Path clonePath) throws IOException {
        Process process = new ProcessBuilder("git", "clone", "--depth", "1", cloneUrl, clonePath.toString())
                .redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .start();

        boolean completed;
        try {
            completed = process.waitFor(90, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub clone was interrupted.", exception);
        }

        if (!completed) {
            process.destroyForcibly();
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "GitHub clone timed out.");
        }

        if (process.exitValue() != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub clone failed. Check the repository URL and access.");
        }
    }

    private String normalizeGitCloneUrl(String githubUrl, String githubOAuthToken) {
        String[] repositoryPath = extractOwnerAndRepository(githubUrl);
        if (StringUtils.hasText(githubOAuthToken)) {
            return "https://x-access-token:" + githubOAuthToken + "@github.com/"
                    + repositoryPath[0] + "/" + repositoryPath[1] + ".git";
        }
        return "https://github.com/" + repositoryPath[0] + "/" + repositoryPath[1] + ".git";
    }

    private List<RepositorySourceFile> scanLocalRepositoryFiles(Path repositoryRoot) throws IOException {
        List<RepositorySourceFile> sourceFiles = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(repositoryRoot)) {
            List<Path> files = paths
                    .filter(Files::isRegularFile)
                    .toList();

            for (Path file : files) {
                if (sourceFiles.size() >= MAX_INDEXED_FILES) {
                    break;
                }

                String relativePath = repositoryRoot.relativize(file).toString().replace("\\", "/");
                if (shouldSkipPath(relativePath) || !isLikelyTextFile(relativePath)) {
                    continue;
                }

                long size = Files.size(file);
                if (size == 0 || size > MAX_INDEXED_FILE_BYTES) {
                    continue;
                }

                byte[] bytes = Files.readAllBytes(file);
                if (looksBinary(bytes)) {
                    continue;
                }

                String content = new String(bytes, StandardCharsets.UTF_8);
                if (StringUtils.hasText(content)) {
                    sourceFiles.add(new RepositorySourceFile(relativePath, content));
                }
            }
        }
        return sourceFiles;
    }

    private void deleteDirectoryQuietly(Path path) {
        if (path == null || !Files.exists(path)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(path)) {
            paths.sorted(Comparator.reverseOrder())
                    .forEach(file -> {
                        try {
                            Files.deleteIfExists(file);
                        } catch (IOException ignored) {
                            // Best-effort cleanup of temporary clone folders.
                        }
                    });
        } catch (IOException ignored) {
            // Best-effort cleanup of temporary clone folders.
        }
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
                .ownerUserId(null)
                .fileCount(sourceFiles.size())
                .linesOfCode(countLines(sourceFiles))
                .status(RepositoryStatus.READY)
                .build();

        Repository savedRepository = repositoryRepository.save(repository);
        generateOverviewArtifacts(savedRepository, "ZIP Upload");
        repositoryChunkService.indexRepository(savedRepository.getId(), withRepositoryContext(savedRepository, sourceFiles));
        return savedRepository;
    }

    private Repository storeZipRepository(RepositoryDTO repositoryDTO, MultipartFile zipFile, Long ownerUserId) {
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
                .ownerUserId(ownerUserId)
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
            String generated = openAiService.generateText(
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
            String sanitized = sanitizeMermaidCode(firstNonBlank(generated, fallback), "Flowchart");
            return normalizeFlowchartDiagram(sanitized, "TD", fallback);
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String normalizeDiagramTitle(String diagramType) {
        String value = firstNonBlank(diagramType, "Flowchart");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.contains("sequence")) {
            return "Sequence Diagram";
        }
        if (normalized.contains("architecture")) {
            return "Architecture";
        }
        if (normalized.contains("class")) {
            return "Class Diagram";
        }
        if (normalized.contains("er") || normalized.contains("entity") || normalized.contains("database")) {
            return "ER Diagram";
        }
        return "Flowchart";
    }

    private String nextDiagramTitle(Long repositoryId, String baseTitle) {
        int nextNumber = diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(repositoryId).stream()
                .map(Diagram::getTitle)
                .map(title -> diagramTitleSequenceNumber(title, baseTitle))
                .filter(number -> number > 0)
                .max(Integer::compareTo)
                .orElse(0) + 1;
        return "%s %s".formatted(baseTitle, nextNumber);
    }

    private int diagramTitleSequenceNumber(String title, String baseTitle) {
        if (!StringUtils.hasText(title) || !StringUtils.hasText(baseTitle)) {
            return 0;
        }

        String trimmedTitle = title.trim();
        if (trimmedTitle.equalsIgnoreCase(baseTitle)) {
            return 1;
        }

        String prefix = baseTitle + " ";
        if (!trimmedTitle.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return 0;
        }

        String suffix = trimmedTitle.substring(prefix.length()).trim();
        if (!suffix.matches("\\d+")) {
            return 0;
        }
        return Integer.parseInt(suffix);
    }

    private String generateMermaidDiagram(Repository repository, String title) {
        String fallback = buildDiagramFallback(repository, title);
        if (!openAiService.isConfigured()) {
            return fallback;
        }

        String context = loadDiagramContext(repository, title);
        try {
            String generated = openAiService.generateText(
                    """
                            You generate Mermaid.js diagrams for code repositories.
                            Return Mermaid code only, with no markdown fences and no explanation.
                            Use the exact Mermaid diagram syntax requested.
                            Include enough repository-specific detail to be useful, but keep labels short and valid for Mermaid.
                            For flowchart diagrams, use simple alphanumeric node IDs like A1, A2, quote every node label like A1["Frontend"], and do not use punctuation-heavy IDs, raw file paths, markdown, HTML, or parentheses in IDs.
                            Do not invent exact classes, endpoints, or services unless they appear in the context.
                            Prefer real file names, classes, controllers, services, entities, tables, and integration names from the context.
                            """,
                    """
                            Diagram type: %s
                            Repository name: %s
                            Description: %s
                            Primary language: %s
                            Detected tech stack: %s
                            File count: %s
                            Lines of code: %s
                            Source reference: %s

                            Repository context:
                            %s

                            Requirements:
                            %s
                            """.formatted(
                            title,
                            firstNonBlank(repository.getName(), "Unknown"),
                            firstNonBlank(repository.getDescription(), "No description provided"),
                            firstNonBlank(repository.getLanguage(), "Unknown"),
                            firstNonBlank(repository.getTechStack(), "Unknown"),
                            repository.getFileCount() != null ? repository.getFileCount() : "Unknown",
                            repository.getLinesOfCode() != null ? repository.getLinesOfCode() : "Unknown",
                            firstNonBlank(repository.getGithubUrl(), "Uploaded ZIP archive"),
                            firstNonBlank(context, "No indexed source context is available. Use metadata only."),
                            diagramRequirements(title)
                    )
            );
            String sanitized = sanitizeMermaidCode(firstNonBlank(generated, fallback), title);
            if ("Flowchart".equals(title)) {
                return normalizeFlowchartDiagram(sanitized, "TD", fallback);
            }
            return hasExpectedMermaidHeader(sanitized, title) ? sanitized : fallback;
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String loadDiagramContext(Repository repository, String title) {
        try {
            ensureRepositoryHasRagContext(repository);
            String retrievalPrompt = "Flowchart".equals(title)
                    ? "Generate a user perspective Mermaid flowchart showing the user's journey, screens, actions, decisions, and visible outcomes in this application."
                    : "Generate " + title + " Mermaid diagram using real repository components, routes, services, entities, data models, database tables, external APIs, and runtime flow.";
            List<RepositoryChunkService.RetrievedChunk> chunks = repositoryChunkService.findRelevantChunks(
                    repository.getId(),
                    retrievalPrompt,
                    14
            );
            return chunks.stream()
                    .map(chunk -> """
                            File: %s
                            %s
                            """.formatted(chunk.filePath(), chunk.content()))
                    .collect(Collectors.joining("\n---\n"));
        } catch (Exception exception) {
            return "";
        }
    }

    private String diagramRequirements(String title) {
        if ("Sequence Diagram".equals(title)) {
            return """
                    Create a Mermaid sequenceDiagram.
                    Show a realistic interaction path across user, frontend, controllers/routes, services, repositories/database, external APIs, and AI provider when they appear in context.
                    Use actor/participant declarations.
                    Include at least 8 message arrows when context supports them.
                    Use ->> for calls and -->> for responses.
                    Start the diagram with: sequenceDiagram
                    """;
        }
        if ("Architecture".equals(title)) {
            return """
                    Create a Mermaid flowchart LR system architecture diagram.
                    Group real repository components into subgraphs such as Frontend, Backend API, Services, Persistence, External Integrations, and AI/RAG when relevant.
                    Include important controllers/pages, services, database tables/stores, GitHub/OpenAI integrations, and generated artifacts from the context.
                    Use labelled arrows for major data flows.
                    Start the diagram with: flowchart LR
                    """;
        }
        if ("Class Diagram".equals(title)) {
            return """
                    Create a Mermaid classDiagram.
                    Include concrete classes/entities/interfaces found in the context and their main relationships.
                    Use inheritance, composition, association, or dependency arrows only when supported by the context.
                    Keep method/property lists short; include names only when visible in the context.
                    Start the diagram with: classDiagram
                    """;
        }
        if ("ER Diagram".equals(title)) {
            return """
                    Create a Mermaid erDiagram.
                    Include concrete database entities/tables found in the context.
                    Add important fields only when visible in the context.
                    Show relationships only when foreign keys, repository fields, or entity references support them.
                    Start the diagram with: erDiagram
                    """;
        }
        return """
                Create a Mermaid flowchart TD.
                Show the flow from the user's perspective, not the repository's internal code structure.
                Focus on what the user does and sees: login, selecting or uploading a repository, waiting for analysis, viewing generated documentation/diagrams, asking AI questions, exporting files, and handling errors when those features appear in context.
                Use user-facing page names, actions, choices, and outcomes from the context instead of class names, controller names, service names, database tables, or internal implementation steps.
                Include decision points for common user choices when context supports them, such as GitHub URL vs ZIP upload, documentation vs diagram generation, or successful generation vs error.
                Include at least 8 user-facing nodes when context supports them.
                Use only simple alphanumeric node IDs such as A1, A2, A3.
                Quote every node label with double quotes, for example A1["User opens dashboard"].
                Do not use raw file paths, dots, slashes, brackets, parentheses, or markdown as node IDs.
                Start the diagram with: flowchart TD
                """;
    }

    private String sanitizeMermaidCode(String mermaidCode, String title) {
        String sanitized = mermaidCode.trim();
        sanitized = sanitized.replaceFirst("(?is)^\\s*```(?:mermaid)?\\s*", "");
        sanitized = sanitized.replaceFirst("(?is)\\s*```\\s*$", "");
        sanitized = trimBeforeMermaidHeader(sanitized);
        if (!hasExpectedMermaidHeader(sanitized, title) && hasAnyMermaidHeader(sanitized)) {
            return sanitized;
        }
        return sanitized.trim();
    }

    private String trimBeforeMermaidHeader(String mermaidCode) {
        String[] headers = {"flowchart TD", "flowchart LR", "sequenceDiagram", "classDiagram", "erDiagram"};
        int firstIndex = -1;
        for (String header : headers) {
            int index = mermaidCode.indexOf(header);
            if (index >= 0 && (firstIndex < 0 || index < firstIndex)) {
                firstIndex = index;
            }
        }
        return firstIndex > 0 ? mermaidCode.substring(firstIndex).trim() : mermaidCode.trim();
    }

    private boolean hasExpectedMermaidHeader(String mermaidCode, String title) {
        if (!StringUtils.hasText(mermaidCode)) {
            return false;
        }
        return mermaidCode.trim().startsWith(expectedMermaidHeader(title));
    }

    private boolean hasAnyMermaidHeader(String mermaidCode) {
        if (!StringUtils.hasText(mermaidCode)) {
            return false;
        }
        String trimmed = mermaidCode.trim();
        return trimmed.startsWith("flowchart TD")
                || trimmed.startsWith("flowchart LR")
                || trimmed.startsWith("sequenceDiagram")
                || trimmed.startsWith("classDiagram")
                || trimmed.startsWith("erDiagram");
    }

    private String normalizeFlowchartDiagram(String mermaidCode, String direction, String fallback) {
        if (!StringUtils.hasText(mermaidCode) || !mermaidCode.trim().startsWith("flowchart " + direction)) {
            return fallback;
        }

        List<String> normalizedLines = new ArrayList<>();
        Map<String, String> nodeIds = new LinkedHashMap<>();
        Map<String, String> nodeLabels = new LinkedHashMap<>();
        Map<String, String> explicitNodeLabels = new LinkedHashMap<>();
        normalizedLines.add("flowchart " + direction);

        for (String rawLine : mermaidCode.split("\\R")) {
            String line = rawLine.trim();
            if (!StringUtils.hasText(line)
                    || line.startsWith("flowchart ")
                    || line.startsWith("%%")
                    || line.equals("end")
                    || line.startsWith("subgraph ")) {
                continue;
            }

            FlowchartNodeDeclaration nodeDeclaration = parseFlowchartNodeDeclaration(line);
            if (nodeDeclaration != null) {
                explicitNodeLabels.put(nodeDeclaration.id(), nodeDeclaration.label());
                continue;
            }

            FlowchartEdge edge = parseFlowchartEdge(line);
            if (edge == null) {
                continue;
            }

            String sourceId = normalizedFlowchartNodeId(edge.source(), nodeIds, nodeLabels, explicitNodeLabels);
            String targetId = normalizedFlowchartNodeId(edge.target(), nodeIds, nodeLabels, explicitNodeLabels);
            normalizedLines.add("    %s --> %s".formatted(sourceId, targetId));
        }

        if (normalizedLines.size() < 3) {
            return fallback;
        }

        List<String> nodeLines = nodeLabels.entrySet().stream()
                .map(entry -> "    %s[\"%s\"]".formatted(entry.getKey(), escapeMermaidLabel(entry.getValue())))
                .toList();

        List<String> result = new ArrayList<>();
        result.add(normalizedLines.get(0));
        result.addAll(nodeLines);
        result.addAll(normalizedLines.subList(1, normalizedLines.size()));
        return String.join("\n", result);
    }

    private FlowchartEdge parseFlowchartEdge(String line) {
        String cleanedLine = line.replaceAll("\\s+", " ");
        String[] arrowParts = cleanedLine.split("\\s*(?:--[^-]*-->|-->|---|-.->|==>)\\s*", 2);
        if (arrowParts.length != 2) {
            return null;
        }

        String source = arrowParts[0].trim();
        String target = arrowParts[1].replaceFirst("^\\|[^|]*\\|\\s*", "").trim();
        if (!StringUtils.hasText(source) || !StringUtils.hasText(target)) {
            return null;
        }

        return new FlowchartEdge(source, target);
    }

    private FlowchartNodeDeclaration parseFlowchartNodeDeclaration(String line) {
        if (parseFlowchartEdge(line) != null) {
            return null;
        }

        String rawId = line.replaceFirst("\\s*[\\[{(].*$", "").trim();
        String label = extractFlowchartNodeLabel(line);
        if (!StringUtils.hasText(rawId) || rawId.equals(label)) {
            return null;
        }

        return new FlowchartNodeDeclaration(rawId, label);
    }

    private String normalizedFlowchartNodeId(
            String rawNode,
            Map<String, String> nodeIds,
            Map<String, String> nodeLabels,
            Map<String, String> explicitNodeLabels
    ) {
        String rawId = rawNode.replaceFirst("\\s*[\\[{(].*$", "").trim();
        String label = extractFlowchartNodeLabel(rawNode);
        if (!StringUtils.hasText(rawId)) {
            rawId = label;
        }
        if (rawId.equals(label)) {
            label = explicitNodeLabels.getOrDefault(rawId, label);
        }

        String resolvedLabel = label;
        String existingNodeId = nodeIds.get(rawId);
        if (existingNodeId != null) {
            String replacementLabel = flowchartNodeLabel(
                    resolvedLabel,
                    explicitNodeLabels.get(rawId),
                    rawId,
                    flowchartStepNumber(existingNodeId)
            );
            if (isFallbackFlowchartLabel(nodeLabels.get(existingNodeId), rawId)
                    && !isFallbackFlowchartLabel(replacementLabel, rawId)) {
                nodeLabels.put(existingNodeId, replacementLabel);
            }
            return existingNodeId;
        }

        return nodeIds.computeIfAbsent(rawId, key -> {
            String nodeId = "N" + (nodeIds.size() + 1);
            int stepNumber = nodeIds.size() + 1;
            nodeLabels.put(nodeId, flowchartNodeLabel(resolvedLabel, explicitNodeLabels.get(key), key, stepNumber));
            return nodeId;
        });
    }

    private String flowchartNodeLabel(String resolvedLabel, String explicitLabel, String rawId, int stepNumber) {
        String label = firstNonBlank(resolvedLabel, explicitLabel);
        if (!StringUtils.hasText(label) || isGenericFlowchartNodeId(label)) {
            label = isGenericFlowchartNodeId(rawId) ? "Flow step " + stepNumber : rawId;
        }
        return firstNonBlank(label, "Flow step " + stepNumber);
    }

    private boolean isGenericFlowchartNodeId(String value) {
        return StringUtils.hasText(value) && value.trim().matches("[A-Z]\\d*");
    }

    private boolean isFallbackFlowchartLabel(String label, String rawId) {
        if (!StringUtils.hasText(label)) {
            return true;
        }
        String trimmed = label.trim();
        return trimmed.equals(rawId)
                || trimmed.matches("Flow step \\d+")
                || isGenericFlowchartNodeId(trimmed);
    }

    private int flowchartStepNumber(String normalizedNodeId) {
        if (StringUtils.hasText(normalizedNodeId) && normalizedNodeId.matches("N\\d+")) {
            return Integer.parseInt(normalizedNodeId.substring(1));
        }
        return 1;
    }

    private String extractFlowchartNodeLabel(String rawNode) {
        String trimmed = rawNode.trim();
        int start = firstNodeLabelStart(trimmed);
        if (start < 0) {
            return trimmed;
        }

        char opener = trimmed.charAt(start);
        char closer = switch (opener) {
            case '[' -> ']';
            case '(' -> ')';
            case '{' -> '}';
            default -> opener;
        };
        int end = trimmed.lastIndexOf(closer);
        if (end <= start) {
            return trimmed.substring(0, start).trim();
        }

        String label = trimmed.substring(start + 1, end).trim();
        if ((label.startsWith("\"") && label.endsWith("\"")) || (label.startsWith("'") && label.endsWith("'"))) {
            label = label.substring(1, label.length() - 1).trim();
        }
        return label;
    }

    private int firstNodeLabelStart(String value) {
        int firstIndex = -1;
        for (char delimiter : new char[] {'[', '(', '{'}) {
            int index = value.indexOf(delimiter);
            if (index >= 0 && (firstIndex < 0 || index < firstIndex)) {
                firstIndex = index;
            }
        }
        return firstIndex;
    }

    private String escapeMermaidLabel(String label) {
        return firstNonBlank(label, "Step")
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replaceAll("[\\[\\]{}<>|`]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String repairGenericFlowchartLabels(String mermaidCode) {
        if (!StringUtils.hasText(mermaidCode) || !mermaidCode.trim().startsWith("flowchart ")) {
            return firstNonBlank(mermaidCode, "");
        }

        List<String> repairedLines = new ArrayList<>();
        int fallbackLabelIndex = 1;
        for (String line : mermaidCode.split("\\R", -1)) {
            String trimmed = line.trim();
            FlowchartNodeDeclaration nodeDeclaration = parseFlowchartNodeDeclaration(trimmed);
            if (nodeDeclaration != null && isGenericFlowchartNodeId(nodeDeclaration.label())) {
                String indentation = line.substring(0, line.length() - line.stripLeading().length());
                repairedLines.add("%s%s[\"Flow step %d\"]".formatted(
                        indentation,
                        nodeDeclaration.id(),
                        fallbackLabelIndex++
                ));
            } else {
                repairedLines.add(line);
            }
        }

        return String.join("\n", repairedLines).trim();
    }

    private record FlowchartEdge(String source, String target) {
    }

    private record FlowchartNodeDeclaration(String id, String label) {
    }

    private String expectedMermaidHeader(String title) {
        if ("Sequence Diagram".equals(title)) {
            return "sequenceDiagram";
        }
        if ("Architecture".equals(title)) {
            return "flowchart LR";
        }
        if ("Class Diagram".equals(title)) {
            return "classDiagram";
        }
        if ("ER Diagram".equals(title)) {
            return "erDiagram";
        }
        return "flowchart TD";
    }

    private String buildDiagramFallback(Repository repository, String title) {
        if ("Sequence Diagram".equals(title)) {
            return buildSequenceDiagram(repository);
        }
        if ("Architecture".equals(title)) {
            return buildArchitectureDiagram(repository);
        }
        if ("Class Diagram".equals(title)) {
            return buildClassDiagram(repository);
        }
        if ("ER Diagram".equals(title)) {
            return buildErDiagram(repository);
        }
        return buildFlowchartDiagram(repository);
    }

    private String buildFlowchartDiagram(Repository repository) {
        return """
                flowchart TD
                    A1["User opens RepoAI"] --> A2["User logs in"]
                    A2 --> A3["User adds repository"]
                    A3 --> A4{"Choose upload method"}
                    A4 --> A5["Paste GitHub URL"]
                    A4 --> A6["Upload ZIP file"]
                    A5 --> A7["Wait for repository analysis"]
                    A6 --> A7
                    A7 --> A8["Open repository workspace"]
                    A8 --> A9{"Choose action"}
                    A9 --> A10["Generate documentation"]
                    A9 --> A11["Generate diagram"]
                    A9 --> A12["Ask AI question"]
                    A10 --> A13["View or export documentation"]
                    A11 --> A14["View Mermaid diagram"]
                    A12 --> A15["Read AI answer"]
                """;
    }

    private String buildArchitectureDiagram(Repository repository) {
        return """
                flowchart LR
                    User[User] --> Frontend[Frontend UI]
                    Frontend --> Backend[Backend API]
                    Backend --> Repo[(Repository Metadata)]
                    Backend --> Docs[(Docs and Diagrams)]
                    Backend --> Chunks[(Repository Chunks)]
                    Backend --> AI[AI Provider]
                    Backend --> GitHub[GitHub API or ZIP Upload]
                    GitHub --> Backend
                    AI --> Backend
                    Backend --> Frontend
                """;
    }

    private String buildSequenceDiagram(Repository repository) {
        return """
                sequenceDiagram
                    actor User
                    participant UI as Frontend
                    participant API as Backend API
                    participant DB as PostgreSQL
                    participant AI as AI Provider
                    User->>UI: Select %s
                    UI->>API: Request diagram generation
                    API->>DB: Load repository metadata and chunks
                    API->>AI: Ask for Mermaid diagram
                    AI-->>API: Mermaid code
                    API->>DB: Save diagram
                    API-->>UI: Return generated diagram
                    UI-->>User: Render Mermaid diagram
                """.formatted(firstNonBlank(repository.getName(), "repository"));
    }

    private String buildClassDiagram(Repository repository) {
        return """
                classDiagram
                    class Repository {
                        Long id
                        String name
                        String language
                        String techStack
                        RepositoryStatus status
                    }
                    class Documentation {
                        Long repositoryId
                        String title
                        String content
                    }
                    class Diagram {
                        Long repositoryId
                        String title
                        String mermaidCode
                    }
                    class AIQuestion {
                        Long repositoryId
                        String questionText
                        String answerText
                    }
                    Repository "1" --> "*" Documentation
                    Repository "1" --> "*" Diagram
                    Repository "1" --> "*" AIQuestion
                """;
    }

    private String buildErDiagram(Repository repository) {
        return """
                erDiagram
                    REPOSITORIES {
                        bigint id
                        string name
                        string github_url
                        string language
                        string tech_stack
                        string status
                    }
                    DOCUMENTATION {
                        bigint id
                        bigint repository_id
                        string title
                        text content
                    }
                    DIAGRAMS {
                        bigint id
                        bigint repository_id
                        string title
                        text mermaid_code
                    }
                    AI_QUESTIONS {
                        bigint id
                        bigint repository_id
                        text question_text
                        text answer_text
                    }
                    REPOSITORIES ||--o{ DOCUMENTATION : has
                    REPOSITORIES ||--o{ DIAGRAMS : has
                    REPOSITORIES ||--o{ AI_QUESTIONS : has
                """;
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

        String context = loadDocumentationContext(repository, title);
        try {
            return openAiService.generateText(
                    """
                            You generate README-style markdown documentation for a code repository.
                            Use only the repository metadata and source context provided.
                            Do not invent endpoints, modules, classes, or commands unless they appear in the context.
                            If details are unknown, say which source files need deeper analysis.
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

                            Repository source context:
                            %s

                            Create useful documentation for this type.
                            """.formatted(
                            title,
                            firstNonBlank(repository.getName(), "Unknown"),
                            firstNonBlank(repository.getDescription(), "No description provided"),
                            firstNonBlank(repository.getLanguage(), "Unknown"),
                            firstNonBlank(repository.getTechStack(), "Unknown"),
                            repository.getFileCount() != null ? repository.getFileCount() : "Unknown",
                            repository.getLinesOfCode() != null ? repository.getLinesOfCode() : "Unknown",
                            firstNonBlank(repository.getGithubUrl(), "Uploaded ZIP archive"),
                            firstNonBlank(context, "No indexed source context is available. Use metadata only.")
                    )
            );
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String loadDocumentationContext(Repository repository, String title) {
        try {
            ensureRepositoryHasRagContext(repository);
            List<RepositoryChunkService.RetrievedChunk> chunks = repositoryChunkService.findRelevantChunks(
                    repository.getId(),
                    "Generate " + title + " for repository modules, APIs, components, configuration, setup, and runtime flow.",
                    12
            );
            return chunks.stream()
                    .map(chunk -> """
                            File: %s
                            %s
                            """.formatted(chunk.filePath(), chunk.content()))
                    .collect(Collectors.joining("\n---\n"));
        } catch (Exception exception) {
            return "";
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
        return normalizedPath.startsWith(".git/")
                || normalizedPath.contains("/.git/")
                || normalizedPath.contains("/node_modules/")
                || normalizedPath.startsWith("node_modules/")
                || normalizedPath.contains("/target/")
                || normalizedPath.startsWith("target/")
                || normalizedPath.contains("/build/")
                || normalizedPath.startsWith("build/")
                || normalizedPath.contains("/dist/")
                || normalizedPath.startsWith("dist/")
                || normalizedPath.contains("/.next/")
                || normalizedPath.startsWith(".next/")
                || normalizedPath.contains("/coverage/")
                || normalizedPath.startsWith("coverage/")
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

    private List<Long> repositoryIdsForOwner(Long ownerUserId) {
        return repositoryRepository.findByOwnerUserId(ownerUserId).stream()
                .map(Repository::getId)
                .toList();
    }

    private Repository requireOwnedRepository(Long repositoryId, Long ownerUserId) {
        return repositoryRepository.findByIdAndOwnerUserId(repositoryId, ownerUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repository not found."));
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
