package dev.fazley.portfolio;

import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.zip.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class ContentStore {
    static final Set<String> SINGLETONS = Set.of("profile","contact","skills","education","experience","achievements","resume","site-settings","reviews");
    static final Set<String> COLLECTIONS = Set.of("projects","research","papers","blogs");
    private final Path workspace;
    private final String python, publicUrl;
    private final ObjectMapper mapper;
    private String revision = Instant.now().toString();

    public ContentStore(ObjectMapper mapper, @Value("${portfolio.source}") String source,
                        @Value("${portfolio.data}") String data, @Value("${portfolio.python}") String python,
                        @Value("${portfolio.public-url}") String publicUrl) throws IOException {
        this.mapper=mapper; this.python=python; this.publicUrl=publicUrl;
        Path seed=Path.of(source).toAbsolutePath().normalize();
        workspace=Path.of(data).toAbsolutePath().normalize().resolve("site");
        if (!Files.isRegularFile(seed.resolve("scripts/build.py"))) throw new IllegalStateException("PORTFOLIO_SOURCE must point to the frontend source folder.");
        Files.createDirectories(workspace);
        // Refresh application code on deploy, but never overwrite persisted content or uploaded files.
        try (Stream<Path> paths=Files.walk(seed)) {
            for (Path file:paths.filter(Files::isRegularFile).toList()) {
                Path relative=seed.relativize(file);
                String top=relative.getName(0).toString();
                if (Set.of("dist",".qa","tests","tools","node_modules","__pycache__").contains(top)
                        || relative.toString().contains("__pycache__") || top.startsWith(".env")) continue;
                Path target=workspace.resolve(relative);
                boolean persisted=Set.of("content","uploads","images").contains(top);
                if (!persisted || !Files.exists(target)) { Files.createDirectories(target.getParent()); Files.copy(file,target,StandardCopyOption.REPLACE_EXISTING); }
            }
        }
        render();
    }
    Path dist() { return workspace.resolve("dist"); }
    private Path contentPath(String section,String id) {
        if (SINGLETONS.contains(section) && (id==null || id.isBlank())) return workspace.resolve("content/"+section+".json");
        if (COLLECTIONS.contains(section) && id != null && id.matches("[a-z0-9]+(?:-[a-z0-9]+)*") && id.length()<=120)
            return workspace.resolve("content/"+section+"/"+id+".json");
        throw new ApiProblem(400,"Invalid collection or record ID.");
    }
    public synchronized Map<String,Object> all() throws IOException {
        Map<String,Object> result=new LinkedHashMap<>();
        for (String name:SINGLETONS) result.put(name,mapper.readTree(Files.readString(contentPath(name,null))));
        for (String name:COLLECTIONS) {
            List<JsonNode> entries=new ArrayList<>();
            try (Stream<Path> paths=Files.list(workspace.resolve("content/"+name))) {
                for (Path path:paths.filter(p->p.toString().endsWith(".json")).sorted().toList()) entries.add(mapper.readTree(Files.readString(path)));
            }
            result.put(name,entries);
        }
        return result;
    }
    public synchronized String schema() throws IOException { return Files.readString(workspace.resolve("cms/schema.json")); }
    public synchronized String blogPage(String id) throws IOException {
        if (id != null && (!id.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || id.length()>120)) throw new ApiProblem(404,"Story unavailable.");
        Path page=dist().resolve(id==null?"blogs/index.html":"blogs/"+id+"/index.html");
        if (!Files.isRegularFile(page)) throw new ApiProblem(404,"Story unavailable.");
        return Files.readString(page);
    }
    public synchronized String page() throws IOException { return Files.readString(dist().resolve("index.html")); }
    public synchronized String revision() { return revision; }

    public synchronized Map<String,String> save(String section,String id,JsonNode value,boolean create) throws IOException {
        Path path=contentPath(section,id);
        if (!value.isObject()) throw new ApiProblem(400,"A content record must be a JSON object.");
        if (COLLECTIONS.contains(section) && !id.equals(value.path("id").asString())) throw new ApiProblem(400,"Record ID cannot change. Create a new record instead.");
        if (create && Files.exists(path)) throw new ApiProblem(409,"This ID already exists.");
        if (!create && !Files.exists(path)) throw new ApiProblem(404,"Record not found.");
        byte[] previous=Files.exists(path)?Files.readAllBytes(path):null;
        Files.createDirectories(path.getParent());
        writeAtomic(path,mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(value));
        try { render(); }
        catch (RuntimeException | IOException e) {
            if(previous==null) Files.deleteIfExists(path); else writeAtomic(path,previous);
            render(); throw e;
        }
        return Map.of("message","Saved and published.","revision",revision);
    }
    public synchronized Map<String,String> delete(String section,String id) throws IOException {
        if (!COLLECTIONS.contains(section)) throw new ApiProblem(400,"Remove individual items using the section editor.");
        Path path=contentPath(section,id);
        if(!Files.exists(path))throw new ApiProblem(404,"Record not found.");
        byte[] backup=Files.readAllBytes(path); Files.delete(path);
        try { render(); } catch(RuntimeException | IOException e) { writeAtomic(path,backup); render(); throw e; }
        return Map.of("message","Deleted and published.","revision",revision);
    }
    static void writeAtomic(Path path,byte[] bytes) throws IOException {
        Path temp=Files.createTempFile(path.getParent(),".save-",".tmp");
        try { Files.write(temp,bytes); Files.move(temp,path,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE); }
        catch(AtomicMoveNotSupportedException e) { Files.move(temp,path,StandardCopyOption.REPLACE_EXISTING); }
        finally { Files.deleteIfExists(temp); }
    }
    private void render() throws IOException {
        Path log=workspace.getParent().resolve("last-build.log");
        ProcessBuilder builder=new ProcessBuilder(python,"scripts/build.py","--site-url",publicUrl,"--output-dir","dist-next");
        builder.directory(workspace.toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("API_BASE_URL","same-origin");
        Process process=builder.start();
        try {
            if(!process.waitFor(180,TimeUnit.SECONDS)) { process.destroyForcibly(); throw new ApiProblem(503,"Publishing timed out. Your previous content was restored."); }
        } catch(InterruptedException e) { Thread.currentThread().interrupt();process.destroyForcibly();throw new IOException("Publishing interrupted",e); }
        if(process.exitValue()!=0) {
            String message=Files.readString(log);
            if(message.length()>1800)message=message.substring(message.length()-1800);
            throw new ApiProblem(422,"Content could not be published: "+message.replace(workspace.toString(),"[site]"));
        }
        Path current=dist(), next=workspace.resolve("dist-next"), previous=workspace.resolve("dist-previous");
        removeGenerated(previous);
        if(Files.exists(current)) Files.move(current,previous);
        try { Files.move(next,current,StandardCopyOption.ATOMIC_MOVE); }
        catch(IOException failure) { if(Files.exists(previous) && !Files.exists(current))Files.move(previous,current);throw failure; }
        removeGenerated(previous);
        revision=Instant.now().toString();
    }
    private void removeGenerated(Path directory) throws IOException {
        if(!directory.equals(workspace.resolve("dist-previous")))throw new IOException("Unexpected build cleanup path");
        if(Files.exists(directory))try(Stream<Path> paths=Files.walk(directory)) {
            for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.delete(path);
        }
    }
    public synchronized Map<String,String> upload(MultipartFile file) throws IOException {
        if(file.isEmpty() || file.getSize()>15*1024*1024)throw new ApiProblem(400,"Choose an image or PDF smaller than 15 MB.");
        byte[] data=file.getBytes();String ext=detect(data);
        if(ext==null)throw new ApiProblem(400,"Use a PNG, JPEG, WebP, GIF or PDF. SVG and executable files are not accepted.");
        String name=UUID.randomUUID()+"."+ext;
        Path directory=workspace.resolve("uploads/admin");Files.createDirectories(directory);writeAtomic(directory.resolve(name),data);
        // Make new files immediately previewable; the next save includes them in the built site too.
        Path publicDir=dist().resolve("uploads/admin");Files.createDirectories(publicDir);writeAtomic(publicDir.resolve(name),data);
        return Map.of("path","uploads/admin/"+name);
    }
    private String detect(byte[] b) {
        if(b.length<12)return null;
        if(b[0]==(byte)0x89 && b[1]=='P' && b[2]=='N' && b[3]=='G' && b[4]==13 && b[5]==10 && b[6]==26 && b[7]==10)return "png";
        if(b[0]==(byte)0xff && b[1]==(byte)0xd8 && b[2]==(byte)0xff)return "jpg";
        String start=new String(b,0,12,java.nio.charset.StandardCharsets.ISO_8859_1);
        if(start.startsWith("RIFF") && start.substring(8).startsWith("WEBP"))return "webp";
        if(start.startsWith("GIF87a") || start.startsWith("GIF89a"))return "gif";
        if(start.startsWith("%PDF-"))return "pdf";
        return null;
    }
    public synchronized byte[] export() throws IOException {
        ByteArrayOutputStream output=new ByteArrayOutputStream();
        try(ZipOutputStream zip=new ZipOutputStream(output)) {
            for(String name:List.of("content","uploads"))try(Stream<Path> paths=Files.walk(workspace.resolve(name))) {
                for(Path file:paths.filter(Files::isRegularFile).toList()) {
                    zip.putNextEntry(new ZipEntry(workspace.relativize(file).toString().replace('\\','/')));Files.copy(file,zip);zip.closeEntry();
                }
            }
        }
        return output.toByteArray();
    }
}
