package com.pmo.backend.dto;

public record AuditorDto(String id, String name, String initials, String color, String role) {

    public static AuditorDto of(String id, String fullName, String role) {
        String name = fullName != null && !fullName.isBlank() ? fullName : "Sin asignar";
        String initials = initialsOf(name);
        return new AuditorDto(id, name, initials, "#5454e9", role != null ? role : "auditor");
    }

    private static String initialsOf(String name) {
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!part.isEmpty()) sb.append(Character.toUpperCase(part.charAt(0)));
            if (sb.length() >= 2) break;
        }
        return sb.length() > 0 ? sb.toString() : "SA";
    }
}
