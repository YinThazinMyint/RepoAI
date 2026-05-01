package com.example.backend.repository;

import com.example.backend.entity.Repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RepositoryRepository extends JpaRepository<Repository, Long> {

    List<Repository> findAllByOrderByCreatedAtDesc();

    List<Repository> findByOwnerUserIdOrderByCreatedAtDesc(Long ownerUserId);

    List<Repository> findByOwnerUserId(Long ownerUserId);

    java.util.Optional<Repository> findByIdAndOwnerUserId(Long id, Long ownerUserId);

    long countByOwnerUserId(Long ownerUserId);
}
