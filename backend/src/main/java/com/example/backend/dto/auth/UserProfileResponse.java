package com.example.backend.dto.auth;

import com.example.backend.entity.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserProfileResponse {

    private Long id;
    private String email;
    private String provider;
    private String name;
    private String username;
    private boolean githubConnected;

    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .provider(user.getProvider())
                .name(user.getName())
                .username(user.getUsername())
                .githubConnected(user.getGithubOAuthToken() != null && !user.getGithubOAuthToken().isBlank())
                .build();
    }
}
