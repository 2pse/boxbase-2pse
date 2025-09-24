-- Führe advance_waitlist manuell aus, um Magnus zu befördern
SELECT advance_waitlist('01234468-b938-4b6a-b6b3-a5254cb0c38f'::uuid);

-- Erstelle einen Trigger, der bei Status-Änderungen automatisch ausgeführt wird
DROP TRIGGER IF EXISTS course_registration_trigger ON course_registrations;

CREATE TRIGGER course_registration_trigger
    AFTER INSERT OR UPDATE ON course_registrations
    FOR EACH ROW
    EXECUTE FUNCTION handle_course_registration_change();