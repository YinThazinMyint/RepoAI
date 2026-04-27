package com.example.backend.dto.auth;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SignupRequest {

    private String email;
    private String name;
    private String password;
    private String username;
}
