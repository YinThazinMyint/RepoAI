package com.example.backend.repository;

import com.example.backend.entity.Diagram;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiagramRepository extends JpaRepository<Diagram, Long> {

    List<Diagram> findByRepositoryIdOrderByUpdatedAtDesc(Long repositoryId);

    long countByRepositoryIdIn(List<Long> repositoryIds);

    void deleteByRepositoryId(Long repositoryId);
}
