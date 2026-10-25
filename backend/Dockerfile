FROM maven:3.9-eclipse-temurin-21 AS java-build
WORKDIR /build
COPY backend/pom.xml ./pom.xml
RUN mvn -B dependency:go-offline
COPY backend/src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-noble
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pil gosu && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 portfolio && mkdir -p /app /var/data && chown -R portfolio:portfolio /app /var/data
WORKDIR /app
COPY --from=java-build /build/target/portfolio-backend-1.0.0.jar app.jar
COPY --chown=portfolio:portfolio frontend /app/frontend
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh
ENV PORTFOLIO_SOURCE=/app/frontend DATA_DIR=/var/data PYTHON_COMMAND=python3 PORT=8080
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
