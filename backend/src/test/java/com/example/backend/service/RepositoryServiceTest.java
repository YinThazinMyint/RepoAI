package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.backend.dto.RepositoryDTO;
import com.example.backend.entity.Diagram;
import com.example.backend.entity.Documentation;
import com.example.backend.entity.Repository;
import com.example.backend.entity.RepositoryStatus;
import com.example.backend.repository.AIQuestionRepository;
import com.example.backend.repository.DiagramRepository;
import com.example.backend.repository.DocumentationRepository;
import com.example.backend.repository.RepositoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
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
}
