package dev.fazley.portfolio;

import java.nio.file.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

class ContentStoreTest {
    @TempDir Path directory;
    @Test void editsPersistAndInvalidRecordsRollBack() throws Exception {
        var mapper=JsonMapper.builder().build();
        String source=Path.of("../frontend").toAbsolutePath().normalize().toString();
        String python=System.getenv().getOrDefault("PYTHON_COMMAND","python");
        var store=new ContentStore(mapper,source,directory.toString(),python,"http://localhost:8080");
        var record=mapper.readTree("{\"id\":\"integration-paper\",\"title\":\"Integration paper\",\"authors\":[\"Test author\"],\"topics\":[\"Machine Learning\"],\"published\":true,\"paper_url\":\"https://example.com/paper\"}");
        store.save("papers","integration-paper",record,true);
        assertTrue(store.page().contains("Integration paper"));
        assertTrue(store.page().contains("Research topics"));
        assertThrows(ApiProblem.class,()->store.save("papers","integration-paper",record,true));
        var invalid=mapper.readTree("{\"id\":\"bad-paper\",\"title\":\"Bad\",\"paper_url\":\"javascript:alert(1)\"}");
        assertThrows(ApiProblem.class,()->store.save("papers","bad-paper",invalid,true));
        assertTrue(store.page().contains("Integration paper"));
        assertThrows(ApiProblem.class,()->store.delete("papers","../profile"));
        var restarted=new ContentStore(mapper,source,directory.toString(),python,"http://localhost:8080");
        assertTrue(restarted.page().contains("Integration paper"));
        restarted.delete("papers","integration-paper");
        assertFalse(restarted.page().contains("Integration paper"));
        assertTrue(restarted.export().length>0);
    }
}
