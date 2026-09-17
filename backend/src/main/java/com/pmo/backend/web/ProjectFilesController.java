package com.pmo.backend.web;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.pmo.backend.dto.ProjectFileDto;
import com.pmo.backend.service.ProjectFilesService;

/** Archivos sueltos bajo proyectos/{id}/ (encuestas offline de idoneidad/madurez). */
@RestController
@RequestMapping("/api/projects/{projectId}/files")
public class ProjectFilesController {

    private final ProjectFilesService projectFilesService;

    public ProjectFilesController(ProjectFilesService projectFilesService) {
        this.projectFilesService = projectFilesService;
    }

    @GetMapping
    public List<ProjectFileDto> list(@PathVariable UUID projectId, @RequestParam(required = false) String prefix) {
        return projectFilesService.list(projectId, prefix);
    }

    @PostMapping
    public ProjectFileDto upload(@PathVariable UUID projectId, @RequestParam("file") MultipartFile file,
                                  @RequestParam(required = false, defaultValue = "") String prefix) {
        return projectFilesService.upload(projectId, file, prefix);
    }

    @DeleteMapping("/{fileName}")
    public void delete(@PathVariable UUID projectId, @PathVariable String fileName) {
        projectFilesService.delete(projectId, fileName);
    }
}
