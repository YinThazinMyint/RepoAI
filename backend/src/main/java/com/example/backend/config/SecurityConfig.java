package com.example.backend.config;

import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.entity.User;
import com.example.backend.security.JwtAuthenticationFilter;
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

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    private final AuthService authService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectProvider<OAuth2AuthorizedClientService> authorizedClientServiceProvider;

    public SecurityConfig(
            AuthService authService,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ObjectProvider<OAuth2AuthorizedClientService> authorizedClientServiceProvider
    ) {
        this.authService = authService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authorizedClientServiceProvider = authorizedClientServiceProvider;
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
                        .requestMatchers(HttpMethod.GET, "/api/user/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/integrations/github/**").authenticated()
                        .requestMatchers("/api/repositories/**").permitAll()
                        .requestMatchers("/dashboard").permitAll()
                        .anyRequest().permitAll())
                .logout(logout -> logout.logoutSuccessUrl("/login"))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        OAuth2AuthorizedClientService authorizedClientService =
                authorizedClientServiceProvider.getIfAvailable();
        if (authorizedClientService != null) {
            http
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
                                String email = oauth2User.getAttribute("email");
                                String name = oauth2User.getAttribute("name");
                                if (email == null) {
                                    email = oauth2User.getAttribute("login");
                                }
                                User user = authService.upsertOAuthUser(
                                        email,
                                        name,
                                        request.getRequestURI().contains("google") ? "GOOGLE" : "GITHUB",
                                        oauthToken
                                );
                                AuthResponse authResponse = authService.buildAuthResponse(user);
                                sendRedirect(response, frontendUrl + "/oauth2/callback?token=" + authResponse.getToken());
                            })
                            .failureHandler((request, response, exception) ->
                                    sendRedirect(response, frontendUrl + "/login?error")))
                    .oauth2Client(Customizer.withDefaults());
        }

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
}
