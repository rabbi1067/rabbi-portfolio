package dev.fazley.portfolio;

public class ApiProblem extends RuntimeException {
    final int status;
    public ApiProblem(int status, String message) { super(message); this.status = status; }
}
