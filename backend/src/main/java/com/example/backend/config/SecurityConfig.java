package com.example.backend.config;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import jakarta.servlet.http.Cookie;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.entity.User;
import com.example.backend.security.JwtAuthenticationFilter;
import com.example.backend.security.JwtService;
import com.example.backend.service.AuthService;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    private final AuthService authService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final OAuth2AuthorizedClientService authorizedClientService;
    private final JwtService jwtService;

    public SecurityConfig(
            AuthService authService,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            OAuth2AuthorizedClientService authorizedClientService,
            JwtService jwtService
    ) {
        this.authService = authService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authorizedClientService = authorizedClientService;
        this.jwtService = jwtService;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/login", "/error").permitAll()
                        .requestMatchers("/oauth2/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                        .requestMatchers("/api/user/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/integrations/github/**").authenticated()
                        .requestMatchers("/api/repositories/**").authenticated()
                        .requestMatchers("/api/dashboard/**").authenticated()
                        .requestMatchers("/dashboard").permitAll()
                        .anyRequest().permitAll())
                .oauth2Login(oauth2 -> oauth2
                        .loginPage("/login")
                        .successHandler((request, response, authentication) -> {
                            OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
                            OAuth2AuthenticationToken oauth2Authentication =
                                    (OAuth2AuthenticationToken) authentication;
                            OAuth2AuthorizedClient authorizedClient = authorizedClientService.loadAuthorizedClient(
                                    oauth2Authentication.getAuthorizedClientRegistrationId(),
                                    oauth2Authentication.getName()
                            );
                            String oauthToken = authorizedClient != null && authorizedClient.getAccessToken() != null
                                    ? authorizedClient.getAccessToken().getTokenValue()
                                    : null;
                            String provider = oauth2Authentication.getAuthorizedClientRegistrationId().toUpperCase();
                            String connectToken = readCookie(request, "repoai_connect_token");
                            if (connectToken != null) {
                                try {
                                    Long currentUserId = jwtService.extractUserId(connectToken);
                                    User connectedUser = authService.connectOAuthProvider(currentUserId, provider, oauthToken);
                                    AuthResponse authResponse = authService.buildAuthResponse(connectedUser);
                                    clearCookie(response, "repoai_connect_token");
                                    sendRedirect(response, frontendUrl + "/oauth2/callback?connected=" + provider.toLowerCase() + "&token=" + encode(authResponse.getToken()));
                                    return;
                                } catch (Exception ignored) {
                                    clearCookie(response, "repoai_connect_token");
                                }
                            }

                            String email = resolveOAuthEmail(provider, oauth2User, oauthToken);
                            String name = oauth2User.getAttribute("name");
                            User user = authService.upsertOAuthUser(
                                    email,
                                    name,
                                    provider,
                                    oauthToken
                            );
                            AuthResponse authResponse = authService.buildAuthResponse(user);
                            sendRedirect(response, frontendUrl + "/oauth2/callback?token=" + encode(authResponse.getToken()));
                        })
                        .failureHandler((request, response, exception) -> {
                            clearCookie(response, "repoai_connect_token");
                            sendRedirect(response, frontendUrl + "/login?error");
                        }))
                .oauth2Client(Customizer.withDefaults())
                .logout(logout -> logout.logoutSuccessUrl("/login"))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(frontendUrl));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private void sendRedirect(jakarta.servlet.http.HttpServletResponse response, String targetUrl) throws IOException {
        response.sendRedirect(targetUrl);
    }

    private String readCookie(jakarta.servlet.http.HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }

        return Arrays.stream(request.getCookies())
                .filter(cookie -> name.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    private void clearCookie(jakarta.servlet.http.HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setHttpOnly(false);
        response.addCookie(cookie);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String resolveOAuthEmail(String provider, OAuth2User oauth2User, String oauthToken) {
        String email = oauth2User.getAttribute("email");
        if (StringUtils.hasText(email)) {
            return email;
        }

        if ("GITHUB".equals(provider) && StringUtils.hasText(oauthToken)) {
            String githubEmail = fetchPrimaryGithubEmail(oauthToken);
            if (StringUtils.hasText(githubEmail)) {
                return githubEmail;
            }
        }

        throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "GitHub did not provide a verified email address. Please make a primary email visible or grant email access, then try again."
        );
    }

    private String fetchPrimaryGithubEmail(String oauthToken) {
        try {
            String body = RestClient.builder()
                    .baseUrl("https://api.github.com")
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + oauthToken)
                    .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                    .build()
                    .get()
                    .uri("/user/emails")
                    .retrieve()
                    .body(String.class);

            JsonNode emails = OBJECT_MAPPER.readTree(body);
            if (!emails.isArray()) {
                return null;
            }

            for (JsonNode emailNode : emails) {
                if (emailNode.path("primary").asBoolean(false)
                        && emailNode.path("verified").asBoolean(false)
                        && StringUtils.hasText(emailNode.path("email").asText(null))) {
                    return emailNode.path("email").asText();
                }
            }
        } catch (Exception ignored) {
            return null;
        }

        return null;
    }
}
