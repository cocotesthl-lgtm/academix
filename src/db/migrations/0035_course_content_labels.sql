-- 0035 Labels editables de la sección "Contenido del curso" por producto
alter table public.courses add column if not exists content_title text;
alter table public.courses add column if not exists module_label text;
alter table public.courses add column if not exists lesson_label text;
alter table public.courses add column if not exists show_content_section boolean not null default true;
