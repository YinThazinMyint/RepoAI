package com.example.backend.service;

import com.example.backend.dto.github.GitHubRepositoryResponse;
import com.example.backend.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@RequiredArgsConstructor
public class GitHubService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Value("${github.api.base-url:https://api.github.com}")
    private String githubApiBaseUrl;

    public List<GitHubRepositoryResponse> getRepositories(User user) {
        if (user == null || !StringUtils.hasText(user.getGithubOAuthToken())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "GitHub is not connected for this account."
            );
        }

        RestClient restClient = RestClient.builder()
                .baseUrl(githubApiBaseUrl)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();

        JsonNode response;
        try {
            String responseBody = restClient.get()
                    .uri("/user/repos?sort=updated&per_page=100")
                    .headers(headers -> headers.setBearerAuth(user.getGithubOAuthToken()))
                    .retrieve()
                    .body(String.class);
            response = OBJECT_MAPPER.readTree(responseBody);
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "GitHub repository fetch failed: " + exception.getStatusCode(),
                    exception
            );
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "GitHub repository response could not be parsed.",
                    exception
            );
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "GitHub repository fetch failed.",
                    exception
            );
        }

        List<GitHubRepositoryResponse> repositories = new ArrayList<>();
        if (response != null && response.isArray()) {
            response.forEach(node -> repositories.add(
                    GitHubRepositoryResponse.builder()
                            .id(node.path("id").asLong())
                            .fullName(node.path("full_name").asText())
                            .htmlUrl(node.path("html_url").asText())
                            .language(node.path("language").asText(null))
                            .name(node.path("name").asText())
                            .isPrivate(node.path("private").asBoolean(false))
                            .build()
            ));
        }

        return repositories;
    }
}
