import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Iniciar sesión · SIGET-Tonalá' };

export default function PaginaLogin() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-bold text-cafe">Iniciar sesión</h1>
      <p className="mt-3 text-lg leading-relaxed text-tinta">
        En esta demostración eliges un perfil ficticio. No necesitas contraseña.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </main>
  );
}
