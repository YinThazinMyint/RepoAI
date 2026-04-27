package com.example.backend.controller;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity
                .badRequest()
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSizeExceeded() {
        return ResponseEntity
                .status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("message", "Uploaded ZIP is too large. Please upload a file smaller than 100MB."));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException exception) {
        return ResponseEntity
                .status(exception.getStatusCode())
                .body(Map.of("message", exception.getReason()));
    }

    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<Map<String, String>> handleRestClientResponse(RestClientResponseException exception) {
        return ResponseEntity
                .status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", "External repository service failed: " + exception.getStatusCode()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception exception) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", buildUnexpectedMessage(exception)));
    }

    private String buildUnexpectedMessage(Exception exception) {
        String message = exception.getMessage();
        Throwable cause = exception.getCause();
        while (cause != null) {
            if (cause.getMessage() != null) {
                message = message + " " + cause.getMessage();
            }
            cause = cause.getCause();
        }

        if (message != null && message.contains("insufficient_quota")) {
            return "OpenAI quota exceeded. Please check your OpenAI billing/credits, then try again.";
        }

        if (message != null && message.contains("invalid_api_key")) {
            return "OpenAI API key is invalid. Please check application.properties and restart the backend.";
        }

        return "Request failed: " + exception.getMessage();
    }
}
