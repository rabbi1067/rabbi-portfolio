package dev.fazley.portfolio;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class AdminSecurity {
    private final String email, passwordHash;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    private final Map<String, Instant> sessions = new ConcurrentHashMap<>();
    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private record Attempt(int count, Instant until) {}

    public AdminSecurity(@Value("${portfolio.admin-email}") String email,
                         @Value("${portfolio.admin-password}") String password,
                         @Value("${portfolio.admin-password-hash}") String hash) {
        if (email.isBlank() || (hash.isBlank() && password.length() < 12))
            throw new IllegalStateException("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters), or ADMIN_PASSWORD_HASH, on the backend only.");
        this.email = email.strip();
        if (!hash.isBlank() && !hash.matches("\\$2[aby]\\$\\d{2}\\$.{53}"))
            throw new IllegalStateException("ADMIN_PASSWORD_HASH must be a BCrypt hash.");
        passwordHash = hash.isBlank() ? encoder.encode(password) : hash;
    }

    public synchronized Map<String, Object> login(String providedEmail, String password, String address) {
        Instant now = Instant.now();
        attempts.entrySet().removeIf(e -> e.getValue().until().isBefore(now));
        Attempt attempt = attempts.get(address);
        if (attempt != null && attempt.count() >= 5) throw new ApiProblem(429, "Too many attempts. Try again in 15 minutes.");
        // Always evaluate BCrypt, including for an unknown email.
        boolean correct = encoder.matches(password, passwordHash);
        if (!correct || !MessageDigest.isEqual(email.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8),
                providedEmail.strip().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8))) {
            if (attempts.size() > 10000) throw new ApiProblem(429, "Login temporarily unavailable. Try later.");
            attempts.put(address, new Attempt(attempt == null ? 1 : attempt.count()+1,
                    attempt == null ? now.plusSeconds(900) : attempt.until()));
            throw new ApiProblem(401, "Email or password is incorrect.");
        }
        attempts.remove(address);
        sessions.entrySet().removeIf(e -> e.getValue().isBefore(now));
        if (sessions.size() >= 100) sessions.clear();
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = now.plusSeconds(8*3600);
        sessions.put(digest(token), expires);
        return Map.of("token", token, "expiresAt", expires.toString(), "email", email);
    }

    private String digest(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public void logout(String authorization) { if (authorization.startsWith("Bearer ")) sessions.remove(digest(authorization.substring(7))); }

    @Bean SecurityFilterChain security(HttpSecurity http, @Value("${portfolio.origins}") String origins) throws Exception {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::strip).filter(s -> !s.isBlank()).toList());
        cors.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization","Content-Type"));
        cors.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**", cors);
        return http.cors(c -> c.configurationSource(source))
            // The API uses an explicit Authorization bearer token; no ambient cookie/session authentication.
            .csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .formLogin(c -> c.disable()).httpBasic(c -> c.disable())
            .authorizeHttpRequests(a -> a.requestMatchers(HttpMethod.OPTIONS,"/**").permitAll()
                .requestMatchers("/api/admin/login").permitAll().requestMatchers("/api/admin/**").authenticated().anyRequest().permitAll())
            .exceptionHandling(e -> e.authenticationEntryPoint((request,response,exception) -> {
                response.setStatus(401); response.setContentType("application/json"); response.getWriter().write("{\"message\":\"Please sign in again.\"}");
            }))
            .addFilterBefore(new OncePerRequestFilter() {
                @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
                    String header = req.getHeader("Authorization");
                    if (header != null && header.startsWith("Bearer ") && header.length() < 256) {
                        Instant expiry = sessions.get(digest(header.substring(7)));
                        if (expiry != null && expiry.isAfter(Instant.now())) SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(email,null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
                    }
                    chain.doFilter(req,res);
                }
            }, UsernamePasswordAuthenticationFilter.class).build();
    }
}
