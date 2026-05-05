package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.backend.dto.RepositoryDTO;
import com.example.backend.dto.repository.RepositoryDetailResponse;
import com.example.backend.entity.Diagram;
import com.example.backend.entity.Documentation;
import com.example.backend.entity.Repository;
import com.example.backend.entity.RepositoryStatus;
import com.example.backend.entity.User;
import com.example.backend.repository.AIQuestionRepository;
import com.example.backend.repository.DiagramRepository;
import com.example.backend.repository.DocumentationRepository;
import com.example.backend.repository.RepositoryRepository;
import com.example.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class RepositoryServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private DocumentationRepository documentationRepository;

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private AIQuestionRepository aiQuestionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private OpenAiService openAiService;

    @Mock
    private RepositoryChunkService repositoryChunkService;

    @Spy
    @InjectMocks
    private RepositoryService repositoryService;

    @Captor
    private ArgumentCaptor<Repository> repositoryCaptor;

    @Captor
    private ArgumentCaptor<Diagram> diagramCaptor;

    @Test
    void uploadRepositoryWithGithubUrlFetchesMetadataAndStoresRepository() throws Exception {
        RepositoryDTO repositoryDTO = RepositoryDTO.builder()
                .githubUrl("https://github.com/openai/sample-repo")
                .build();

        when(repositoryRepository.save(any(Repository.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(openAiService.isConfigured()).thenReturn(false);
        doReturn(OBJECT_MAPPER.readTree("""
                {
                  "name": "sample-repo",
                  "language": "Java",
                  "topics": ["spring-boot", "postgresql"]
                }
                """))
                .when(repositoryService)
                .fetchGithubRepositoryMetadata(repositoryDTO.getGithubUrl());
        doReturn(createSampleZipBytes())
                .when(repositoryService)
                .fetchGithubRepositoryArchive(repositoryDTO.getGithubUrl(), "main", null);

        repositoryService.uploadRepository(repositoryDTO);

        verify(repositoryRepository, times(2)).save(repositoryCaptor.capture());
        Repository savedRepository = repositoryCaptor.getAllValues().get(1);

        assertEquals("sample-repo", savedRepository.getName());
        assertEquals("https://github.com/openai/sample-repo", savedRepository.getGithubUrl());
        assertEquals("Java", savedRepository.getLanguage());
        assertEquals("spring-boot, postgresql", savedRepository.getTechStack());
        assertEquals(RepositoryStatus.READY, savedRepository.getStatus());
        assertEquals(2, savedRepository.getFileCount());
        assertTrue(savedRepository.getLinesOfCode() > 0);
    }

    @Test
    void uploadRepositoryWithZipFileParsesStructureAndStoresRepository() throws IOException {
        RepositoryDTO repositoryDTO = RepositoryDTO.builder()
                .zipFile(createSampleZipBase64())
                .build();

        when(repositoryRepository.save(any(Repository.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(openAiService.isConfigured()).thenReturn(false);

        repositoryService.uploadRepository(repositoryDTO);

        verify(repositoryRepository).save(repositoryCaptor.capture());
        Repository savedRepository = repositoryCaptor.getValue();

        assertEquals("sample-zip-repo", savedRepository.getName());
        assertNull(savedRepository.getGithubUrl());
        assertEquals("Java", savedRepository.getLanguage());
        assertEquals(RepositoryStatus.READY, savedRepository.getStatus());
        assertTrue(savedRepository.getTechStack().contains("Spring Boot"));
        assertTrue(savedRepository.getTechStack().contains("Maven"));
    }

    @Test
    void uploadRepositoryRejectsMultipartZipAtOneHundredMegabytes() {
        MultipartFile zipFile = org.mockito.Mockito.mock(MultipartFile.class);
        when(zipFile.isEmpty()).thenReturn(false);
        when(zipFile.getOriginalFilename()).thenReturn("large-repo.zip");
        when(zipFile.getSize()).thenReturn(100L * 1024 * 1024);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> repositoryService.uploadRepository(null, zipFile, null, null, null, null, "public", 7L, null)
        );

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, exception.getStatusCode());
        assertEquals(
                "ZIP file must be smaller than 100MB. Please compress a smaller repository archive and upload a .zip file.",
                exception.getReason()
        );
        verify(repositoryRepository, never()).save(any(Repository.class));
    }

    @Test
    void deleteRepositoryRemovesOwnedRepositoryAndGeneratedArtifacts() {
        Repository repository = Repository.builder()
                .id(42L)
                .ownerUserId(7L)
                .name("sample-repo")
                .build();

        when(repositoryRepository.findByIdAndOwnerUserId(42L, 7L))
                .thenReturn(Optional.of(repository));

        repositoryService.deleteRepository(42L, 7L);

        verify(repositoryChunkService).deleteRepositoryChunks(42L);
        verify(aiQuestionRepository).deleteByRepositoryId(42L);
        verify(diagramRepository).deleteByRepositoryId(42L);
        verify(documentationRepository).deleteByRepositoryId(42L);
        verify(repositoryRepository).delete(repository);
    }

    @Test
    void generateCodeReviewStoresReviewForOwnedRepository() {
        Repository repository = Repository.builder()
                .id(42L)
                .ownerUserId(7L)
                .name("sample-repo")
                .language("Java")
                .techStack("Spring Boot")
                .fileCount(12)
                .linesOfCode(450L)
                .build();

        when(repositoryRepository.findByIdAndOwnerUserId(42L, 7L)).thenReturn(Optional.of(repository));
        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(quotaUser(7L, 0, Instant.now())));
        when(openAiService.isConfigured()).thenReturn(false);
        when(documentationRepository.save(any(Documentation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Documentation review = repositoryService.generateCodeReview(42L, 7L);

        assertEquals("Code Review", review.getTitle());
        assertTrue(review.getContent().contains("# Code Review"));
        assertTrue(review.getContent().contains("sample-repo"));
        verify(documentationRepository).save(any(Documentation.class));
    }

    @Test
    void generateCodeReviewRejectsWhenDailyAiGenerationLimitIsReached() {
        Repository repository = Repository.builder()
                .id(42L)
                .ownerUserId(7L)
                .name("sample-repo")
                .build();

        when(repositoryRepository.findByIdAndOwnerUserId(42L, 7L)).thenReturn(Optional.of(repository));
        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(quotaUser(7L, 20, Instant.now())));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> repositoryService.generateCodeReview(42L, 7L)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, exception.getStatusCode());
        assertTrue(exception.getReason().contains("Daily AI generation limit reached."));
        verify(documentationRepository, never()).save(any(Documentation.class));
    }

    @Test
    void deleteDocumentationRemovesOwnedRepositoryDocument() {
        Repository repository = Repository.builder()
                .id(42L)
                .ownerUserId(7L)
                .name("sample-repo")
                .build();
        Documentation documentation = Documentation.builder()
                .id(9L)
                .repositoryId(42L)
                .title("Project Overview")
                .content("# Overview")
                .build();

        when(repositoryRepository.findByIdAndOwnerUserId(42L, 7L)).thenReturn(Optional.of(repository));
        when(documentationRepository.deleteByIdAndRepositoryId(9L, 42L)).thenReturn(1L);

        repositoryService.deleteDocumentation(42L, 9L, 7L);

        verify(documentationRepository).deleteByIdAndRepositoryId(9L, 42L);
    }

    @Test
    void deleteDiagramRemovesOwnedRepositoryDiagram() {
        Repository repository = Repository.builder()
                .id(42L)
                .ownerUserId(7L)
                .name("sample-repo")
                .build();
        Diagram diagram = Diagram.builder()
                .id(11L)
                .repositoryId(42L)
                .title("Flowchart 1")
                .mermaidCode("flowchart TD\nA --> B")
                .build();

        when(repositoryRepository.findByIdAndOwnerUserId(42L, 7L)).thenReturn(Optional.of(repository));
        when(diagramRepository.deleteByIdAndRepositoryId(11L, 42L)).thenReturn(1L);

        repositoryService.deleteDiagram(42L, 11L, 7L);

        verify(diagramRepository).deleteByIdAndRepositoryId(11L, 42L);
    }

    @Test
    void generateFlowchartRepairsAiMermaidBeforeSaving() {
        Repository repository = Repository.builder()
                .id(35L)
                .name("repoai")
                .language("Java")
                .techStack("Spring Boot, Next.js")
                .build();

        when(repositoryRepository.findById(35L)).thenReturn(Optional.of(repository));
        when(diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(35L)).thenReturn(List.of());
        when(openAiService.isConfigured()).thenReturn(true);
        when(repositoryChunkService.countIndexedChunks(35L)).thenReturn(2);
        when(repositoryChunkService.findRelevantChunks(any(), anyString(), anyInt())).thenReturn(List.of());
        when(openAiService.generateText(anyString(), anyString())).thenReturn("""
                flowchart TD
                    src/main/App.java[App.java (entry)] --> backend/service/RepositoryService.java[RepositoryService.generateDiagram()]
                    backend/service/RepositoryService.java --> frontend/components/mermaid-diagram.tsx[Mermaid preview]
                """);
        when(diagramRepository.save(any(Diagram.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Diagram diagram = repositoryService.generateDiagram(35L, "Flowchart");

        verify(diagramRepository).save(diagramCaptor.capture());
        String mermaidCode = diagramCaptor.getValue().getMermaidCode();

        assertEquals(diagram, diagramCaptor.getValue());
        assertEquals("Flowchart 1", diagramCaptor.getValue().getTitle());
        assertTrue(mermaidCode.startsWith("flowchart TD"));
        assertTrue(mermaidCode.contains("N1[\"App.java (entry)\"]"));
        assertTrue(mermaidCode.contains("N2[\"RepositoryService.generateDiagram()\"]"));
        assertTrue(mermaidCode.contains("N1 --> N2"));
        assertTrue(mermaidCode.contains("N2 --> N3"));
    }

    @Test
    void generateFlowchartPreservesLabelsFromStandaloneNodeDeclarations() {
        Repository repository = Repository.builder()
                .id(35L)
                .name("repoai")
                .language("Java")
                .techStack("Spring Boot, Next.js")
                .build();

        when(repositoryRepository.findById(35L)).thenReturn(Optional.of(repository));
        when(diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(35L)).thenReturn(List.of());
        when(openAiService.isConfigured()).thenReturn(true);
        when(repositoryChunkService.countIndexedChunks(35L)).thenReturn(2);
        when(repositoryChunkService.findRelevantChunks(any(), anyString(), anyInt())).thenReturn(List.of());
        when(openAiService.generateText(anyString(), anyString())).thenReturn("""
                flowchart TD
                    A1["Repository selected"]
                    A2["Frontend requests diagram"]
                    B1["Backend generates Mermaid"]
                    A1 --> A2
                    A2 -- authenticated request --> B1
                """);
        when(diagramRepository.save(any(Diagram.class))).thenAnswer(invocation -> invocation.getArgument(0));

        repositoryService.generateDiagram(35L, "Flowchart");

        verify(diagramRepository).save(diagramCaptor.capture());
        String mermaidCode = diagramCaptor.getValue().getMermaidCode();

        assertTrue(mermaidCode.contains("N1[\"Repository selected\"]"));
        assertTrue(mermaidCode.contains("N2[\"Frontend requests diagram\"]"));
        assertTrue(mermaidCode.contains("N3[\"Backend generates Mermaid\"]"));
        assertTrue(mermaidCode.contains("N1 --> N2"));
        assertTrue(mermaidCode.contains("N2 --> N3"));
        assertFalse(mermaidCode.contains("N1[\"A1\"]"));
        assertFalse(mermaidCode.contains("N2[\"A2\"]"));
    }

    @Test
    void generateFlowchartDoesNotExposeUndeclaredGenericNodeIdsAsLabels() {
        Repository repository = Repository.builder()
                .id(35L)
                .name("repoai")
                .language("Java")
                .techStack("Spring Boot, Next.js")
                .build();

        when(repositoryRepository.findById(35L)).thenReturn(Optional.of(repository));
        when(diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(35L)).thenReturn(List.of());
        when(openAiService.isConfigured()).thenReturn(true);
        when(repositoryChunkService.countIndexedChunks(35L)).thenReturn(2);
        when(repositoryChunkService.findRelevantChunks(any(), anyString(), anyInt())).thenReturn(List.of());
        when(openAiService.generateText(anyString(), anyString())).thenReturn("""
                flowchart TD
                    A1["User request"]
                    A1 --> A2
                    A2 --> RootLayout
                    RootLayout["Root layout"] --> B
                """);
        when(diagramRepository.save(any(Diagram.class))).thenAnswer(invocation -> invocation.getArgument(0));

        repositoryService.generateDiagram(35L, "Flowchart");

        verify(diagramRepository).save(diagramCaptor.capture());
        String mermaidCode = diagramCaptor.getValue().getMermaidCode();

        assertTrue(mermaidCode.contains("N1[\"User request\"]"));
        assertTrue(mermaidCode.contains("N2[\"Flow step 2\"]"));
        assertTrue(mermaidCode.contains("N3[\"Root layout\"]"));
        assertTrue(mermaidCode.contains("N4[\"Flow step 4\"]"));
        assertFalse(mermaidCode.contains("[\"A2\"]"));
        assertFalse(mermaidCode.contains("[\"B\"]"));
    }

    @Test
    void getRepositoryRepairsSavedFlowchartsWithGenericNodeLabelsForDisplay() {
        Repository repository = Repository.builder()
                .id(35L)
                .name("repoai")
                .build();
        Diagram diagram = Diagram.builder()
                .id(7L)
                .repositoryId(35L)
                .title("Flowchart 1")
                .mermaidCode("""
                        flowchart TD
                            N1["A2"]
                            N2["RootLayout"]
                            N1 --> N2
                        """)
                .build();

        when(repositoryRepository.findById(35L)).thenReturn(Optional.of(repository));
        when(documentationRepository.findByRepositoryIdOrderByUpdatedAtDesc(35L)).thenReturn(List.of());
        when(diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(35L)).thenReturn(List.of(diagram));
        when(aiQuestionRepository.findByRepositoryIdOrderByRespondedAtDesc(35L)).thenReturn(List.of());

        RepositoryDetailResponse response = repositoryService.getRepository(35L);

        String mermaidCode = response.getDiagrams().getFirst().getMermaidCode();
        assertTrue(mermaidCode.contains("N1[\"Flow step 1\"]"));
        assertTrue(mermaidCode.contains("N2[\"RootLayout\"]"));
        assertFalse(mermaidCode.contains("[\"A2\"]"));
    }

    @Test
    void generateDiagramNumbersRepeatedDiagramsPerRepositoryAndType() {
        Repository repository = Repository.builder()
                .id(35L)
                .name("repoai")
                .language("Java")
                .techStack("Spring Boot")
                .build();

        when(repositoryRepository.findById(35L)).thenReturn(Optional.of(repository));
        when(diagramRepository.findByRepositoryIdOrderByUpdatedAtDesc(35L)).thenReturn(List.of(
                Diagram.builder().repositoryId(35L).title("Flowchart 2").mermaidCode("flowchart TD\nA --> B").build(),
                Diagram.builder().repositoryId(35L).title("Architecture 1").mermaidCode("flowchart LR\nA --> B").build(),
                Diagram.builder().repositoryId(35L).title("Flowchart").mermaidCode("flowchart TD\nA --> B").build()
        ));
        when(openAiService.isConfigured()).thenReturn(false);
        when(diagramRepository.save(any(Diagram.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Diagram diagram = repositoryService.generateDiagram(35L, "Flowchart");

        assertEquals("Flowchart 3", diagram.getTitle());
        assertEquals("Flowchart", diagram.getType());
    }

    private String createSampleZipBase64() throws IOException {
        return Base64.getEncoder().encodeToString(createSampleZipBytes());
    }

    private byte[] createSampleZipBytes() throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        try (ZipOutputStream zipOutputStream = new ZipOutputStream(outputStream, StandardCharsets.UTF_8)) {
            addZipEntry(zipOutputStream, "sample-zip-repo/pom.xml", """
                    <project>
                        <modelVersion>4.0.0</modelVersion>
                    </project>
                    """);
            addZipEntry(zipOutputStream, "sample-zip-repo/src/main/java/com/example/App.java", """
                    public class App {}
                    """);
        }

        return outputStream.toByteArray();
    }

    private void addZipEntry(ZipOutputStream zipOutputStream, String name, String content) throws IOException {
        ZipEntry zipEntry = new ZipEntry(name);
        zipOutputStream.putNextEntry(zipEntry);
        zipOutputStream.write(content.getBytes(StandardCharsets.UTF_8));
        zipOutputStream.closeEntry();
    }

    private User quotaUser(Long id, int aiGenerationCount, Instant windowStart) {
        return User.builder()
                .id(id)
                .email("dev@gmail.com")
                .name("Dev")
                .username("dev")
                .aiGenerationCount(aiGenerationCount)
                .aiGenerationWindowStart(windowStart)
                .build();
    }
}
