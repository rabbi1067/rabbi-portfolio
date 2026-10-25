package dev.fazley.portfolio;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AdminSecurityTest {
    @Test void credentialsAreRequiredAndLoginIsRateLimited() {
        assertThrows(IllegalStateException.class,()->new AdminSecurity("","", ""));
        AdminSecurity security=new AdminSecurity("owner@example.test","test-only-long-password","");
        for(int i=0;i<5;i++)assertEquals(401,assertThrows(ApiProblem.class,()->security.login("owner@example.test","wrong","127.0.0.9")).status);
        assertEquals(429,assertThrows(ApiProblem.class,()->security.login("owner@example.test","test-only-long-password","127.0.0.9")).status);
        var result=security.login("OWNER@example.test","test-only-long-password","127.0.0.10");
        assertEquals("owner@example.test",result.get("email"));
        assertTrue(result.get("token").toString().length()>40);
    }
}
