package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
@Slf4j
public class OpenAiService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final String embeddingModel;

    public OpenAiService(
            @Value("${openai.api.key:}") String apiKey,
            @Value("${openai.base-url:${openai.api.url:https://api.openai.com/v1}}") String baseUrl,
            @Value("${openai.model:gpt-4}") String model,
            @Value("${openai.embedding-model:text-embedding-3-small}") String embeddingModel
    ) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.model = model;
        this.embeddingModel = embeddingModel;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(apiKey);
    }

    public String generateText(String instructions, String input) {
        if (!isConfigured()) {
            throw new IllegalStateException("OpenAI API key is not configured.");
        }

        RestClient restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        String responseBody = usesOpenRouter()
                ? generateChatCompletion(restClient, instructions, input)
                : generateResponseText(restClient, instructions, input);

        JsonNode response = parseResponse(responseBody);
        String outputText = firstNonBlank(
                extractOutputText(response),
                extractChatCompletionText(response)
        );
        if (!StringUtils.hasText(outputText)) {
            throw new IllegalStateException("OpenAI returned an empty response.");
        }

        return outputText.trim();
    }

    private String generateResponseText(RestClient restClient, String instructions, String input) {
        try {
            return restClient.post()
                    .uri("/responses")
                    .body(new ResponseRequest(model, instructions, input))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException exception) {
            log.info("Responses API failed for configured provider; retrying with chat completions.");
            return generateChatCompletion(restClient, instructions, input);
        }
    }

    private String generateChatCompletion(RestClient restClient, String instructions, String input) {
        return restClient.post()
                .uri("/chat/completions")
                .body(new ChatCompletionRequest(
                        model,
                        List.of(
                                new ChatMessage("system", instructions),
                                new ChatMessage("user", input)
                        )
                ))
                .retrieve()
                .body(String.class);
    }

    private boolean usesOpenRouter() {
        return baseUrl != null && baseUrl.contains("openrouter.ai");
    }

    public List<Double> generateEmbedding(String input) {
        if (!isConfigured()) {
            throw new IllegalStateException("OpenAI API key is not configured.");
        }

        RestClient restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        String responseBody = restClient.post()
                .uri("/embeddings")
                .body(new EmbeddingRequest(embeddingModel, input))
                .retrieve()
                .body(String.class);

        List<Double> embedding = extractEmbedding(parseResponse(responseBody));
        if (embedding.isEmpty()) {
            throw new IllegalStateException("OpenAI returned an empty embedding.");
        }

        return embedding;
    }

    private JsonNode parseResponse(String responseBody) {
        try {
            return OBJECT_MAPPER.readTree(responseBody);
        } catch (IOException exception) {
            throw new IllegalStateException("OpenAI response could not be parsed.", exception);
        }
    }

    private String extractOutputText(JsonNode response) {
        if (response == null) {
            return null;
        }

        JsonNode output = response.path("output");
        if (!output.isArray()) {
            return null;
        }

        List<String> chunks = new ArrayList<>();
        output.forEach(item -> item.path("content").forEach(contentNode -> {
            String text = contentNode.path("text").asText(null);
            if (StringUtils.hasText(text)) {
                chunks.add(text);
            }
        }));

        return String.join("\n", chunks);
    }

    private String extractChatCompletionText(JsonNode response) {
        if (response == null) {
            return null;
        }

        return response.path("choices").path(0).path("message").path("content").asText(null);
    }

    private List<Double> extractEmbedding(JsonNode response) {
        if (response == null) {
            return List.of();
        }

        JsonNode embeddingNode = response.path("data").path(0).path("embedding");
        if (!embeddingNode.isArray()) {
            return List.of();
        }

        List<Double> embedding = new ArrayList<>();
        embeddingNode.forEach(value -> embedding.add(value.asDouble()));
        return embedding;
    }

    private record ResponseRequest(String model, String instructions, String input) {
    }

    private record ChatCompletionRequest(String model, List<ChatMessage> messages) {
    }

    private record ChatMessage(String role, String content) {
    }

    private record EmbeddingRequest(String model, String input) {
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }
}
