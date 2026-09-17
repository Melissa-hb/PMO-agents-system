package com.pmo.backend.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AsyncConfig {

    /**
     * Ejecuta los auto-triggers entre fases (fase1 -> agente9, fase3 -> fase4) en background,
     * igual que edgeRuntime.waitUntil() en el original: la respuesta HTTP no espera a que terminen.
     */
    @Bean("pmoAgentExecutor")
    public Executor pmoAgentExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("pmo-agent-");
        executor.initialize();
        return executor;
    }
}
