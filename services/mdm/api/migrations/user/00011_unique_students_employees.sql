-- +goose Up
-- Повторный импорт создавал дубли студентов/сотрудников. Сначала схлопываем
-- уже накопившиеся дубли (оставляем самую раннюю запись), затем закрепляем
-- уникальность на уровне БД.
-- Студент уникален по (user_id, group, record_book), а не по user_id: один
-- человек может учиться в двух группах.
DELETE FROM students s
USING students k
WHERE s.user_id = k.user_id
  AND s."group" IS NOT DISTINCT FROM k."group"
  AND s.record_book IS NOT DISTINCT FROM k.record_book
  AND s.id > k.id;

DELETE FROM employees e
USING employees k
WHERE e.user_id = k.user_id
  AND e.department = k.department
  AND e.id > k.id;

CREATE UNIQUE INDEX idx_students_user_group_record_book ON students (user_id, "group", record_book);
CREATE UNIQUE INDEX idx_employees_user_department ON employees (user_id, department);

-- +goose Down
DROP INDEX idx_employees_user_department;
DROP INDEX idx_students_user_group_record_book;
