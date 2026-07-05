// Registro best-effort: un fallo aquí nunca debe romper la acción admin que lo originó.
export async function logAdminAction(requestSupabase, {
  adminUser,
  action,
  entityType,
  entityId,
  before,
  after,
}) {
  try {
    const { error } = await requestSupabase.from("admin_audit_logs").insert({
      admin_user_id: adminUser?.id || null,
      admin_email: adminUser?.email || null,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      before_data: before ?? null,
      after_data: after ?? null,
    });

    if (error) {
      console.error("Audit log insert error:", error.message);
    }
  } catch (error) {
    console.error("Audit log insert error:", error.message);
  }
}
