package com.example.backend.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class DashboardStatsResponse {

    private long repositories;
    private long questions;
    private long docs;
    private long diagrams;
}
