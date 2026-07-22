import { redirect } from 'next/navigation';

// La lista "Mis publicaciones" se movió a /owner/mis-publicaciones para
// que la URL coincida con el label del sidebar. Redirect para no romper
// bookmarks ni links viejos.
export default function CoursesRedirect() {
  redirect('/owner/mis-publicaciones');
}
