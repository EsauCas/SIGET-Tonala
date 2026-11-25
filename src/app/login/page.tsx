import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Iniciar sesión · SIGET-Tonalá' };

export default function PaginaLogin() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-bold text-tinta">Iniciar sesión</h1>
      <p className="mt-2 text-lg text-tinta">Entra con el usuario que te dio la Dirección de Padrón y Licencias.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </main>
  );
}
