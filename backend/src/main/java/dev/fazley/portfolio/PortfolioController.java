package dev.fazley.portfolio;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.config.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
public class PortfolioController implements WebMvcConfigurer {
    private final ContentStore store;
    private final AdminSecurity security;
    PortfolioController(ContentStore store,AdminSecurity security) { this.store=store;this.security=security; }

    @GetMapping("/api/public/health") Map<String,Object> health() { return Map.of("status","ok","revision",store.revision()); }
    @GetMapping(value="/api/public/page",produces=MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> page() throws IOException { return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(store.page()); }
    @GetMapping(value={"/api/public/blogs","/blogs/"},produces=MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> blogs() throws IOException { return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(store.blogPage(null)); }
    @GetMapping(value={"/api/public/blogs/{id}","/blogs/{id}/"},produces=MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> blog(@PathVariable String id) throws IOException { return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(store.blogPage(id)); }
    @PostMapping("/api/admin/login") Map<String,Object> login(@RequestBody Map<String,String> body,HttpServletRequest request) {
        return security.login(body.getOrDefault("email",""),body.getOrDefault("password",""),request.getRemoteAddr());
    }
    @PostMapping("/api/admin/logout") Map<String,String> logout(@RequestHeader("Authorization") String token) { security.logout(token);return Map.of("message","Signed out."); }
    @GetMapping("/api/admin/content") Map<String,Object> content() throws IOException { return store.all(); }
    @GetMapping(value="/api/admin/schema",produces=MediaType.APPLICATION_JSON_VALUE) String schema() throws IOException { return store.schema(); }
    @PutMapping("/api/admin/content/{section}") Map<String,String> singleton(@PathVariable String section,@RequestBody JsonNode value) throws IOException { return store.save(section,null,value,false); }
    @PutMapping("/api/admin/content/{section}/{id}") Map<String,String> update(@PathVariable String section,@PathVariable String id,@RequestBody JsonNode value) throws IOException { return store.save(section,id,value,false); }
    @PostMapping("/api/admin/content/{section}/{id}") Map<String,String> create(@PathVariable String section,@PathVariable String id,@RequestBody JsonNode value) throws IOException { return store.save(section,id,value,true); }
    @DeleteMapping("/api/admin/content/{section}/{id}") Map<String,String> delete(@PathVariable String section,@PathVariable String id) throws IOException { return store.delete(section,id); }
    @PostMapping("/api/admin/uploads") Map<String,String> upload(@RequestParam("file") MultipartFile file) throws IOException { return store.upload(file); }
    @GetMapping("/api/admin/export") ResponseEntity<byte[]> export() throws IOException {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=portfolio-backup.zip")
            .contentType(MediaType.parseMediaType("application/zip")).body(store.export());
    }
    @GetMapping({"/CV.pdf","/media/CV.pdf"}) ResponseEntity<Resource> downloadCv() {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=Md_Fazle_Rabbi_CV.pdf")
            .cacheControl(CacheControl.noCache()).body(new FileSystemResource(store.dist().resolve("CV.pdf")));
    }
    @GetMapping({"/","/admin/","/admin/github/"}) ResponseEntity<Resource> index(HttpServletRequest request) {
        String path=request.getRequestURI().equals("/")?"index.html":request.getRequestURI().substring(1)+"index.html";
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).cacheControl(CacheControl.noCache()).body(new FileSystemResource(store.dist().resolve(path)));
    }
    @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/**").addResourceLocations(store.dist().toUri().toString()).setCachePeriod(60);
        registry.addResourceHandler("/**").addResourceLocations(store.dist().toUri().toString()).setCachePeriod(60);
    }
    @ExceptionHandler(ApiProblem.class) ResponseEntity<Map<String,String>> problem(ApiProblem e) { return ResponseEntity.status(e.status).body(Map.of("message",e.getMessage())); }
    @ExceptionHandler({IOException.class,IllegalArgumentException.class}) ResponseEntity<Map<String,String>> badRequest(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("message","The request could not be completed. Check the supplied fields and files."));
    }
}
