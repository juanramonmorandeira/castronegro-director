// src/lib/i18n.js
import { writable, derived, get } from 'svelte/store';

// Idioma por defecto (EN). Podrías leer de localStorage si lo deseas.
const initial = 'en';

export const availableLocales = ['en', 'es', 'hu'];
export const locale = writable(initial);

// Diccionario base
const dictionaries = {
  en: {
    common: {
      app_name: 'Village Storyteller',
      untitled: 'Untitled',
      untitled_session: 'Untitled session',
      loading: 'Loading…',
      error_prefix: 'Error',
      languages: {
        en: 'English',
        es: 'Spanish',
        hu: 'Hungarian'
      },
      actions: {
        view: 'View',
        edit: 'Edit',
        delete: 'Delete'
      }
    },
    topbar: {
      title: 'Storyteller Dashboard',
      language_label: 'Language',
      change_language: 'Change language',
      change_language_current: 'Change language, current: {language}',
      navigation_label: 'Top navigation'
    },
    header: {
      title: 'The Village Storyteller',
      logo_alt: 'Village Storyteller logo'
    },
    login: {
      title: 'Login',
      storytellers: 'Storytellers',
      players: 'Players',
      choose_role: 'Choose how you want to enter',
      registration_cta: 'Registration',
      form: {
        section_label: 'Login with email',
        email_label: 'Email',
        email_placeholder: 'you@example.com',
        password_label: 'Password',
        password_placeholder: 'Enter your password',
        submit: 'Sign in',
        forgot: 'Forgot your password?',
        role_label: 'Sign in as',
        roles: {
          storyteller: 'Storyteller',
          player: 'Player'
        },
        register_prompt: "Don't have an account yet?",
        register_link: 'Create one here',
        errors: {
          missing_email: 'Please enter an email address.',
          invalid_email: 'Please enter a valid email address.',
          missing_password: 'Please enter your password.',
          invalid_credentials: 'Incorrect email or password.',
          account_disabled: 'This account is disabled. Contact support.',
          too_many_attempts: 'Too many attempts. Try again later.',
          generic: 'Login failed. Please try again.'
        },
        success: {
          reset_link_sent: 'If that email exists, we have sent you a reset link.'
        }
      }
    },
    registration: {
      title: 'Registration',
      placeholder: 'Registration page placeholder (to be implemented).'
    },
    landing: {
      current: {
        checking: 'Checking current game session…',
        active_prefix: 'Active game:',
        no_active: 'No active game sessions right now.',
        create: 'Create new game',
        view: 'View current game'
      },
      history: {
        title: 'History',
        search_placeholder: 'Search by title, status or winner…',
        loading: 'Loading…',
        error_prefix: 'Error',
        empty: 'There are no sessions recorded.',
        empty_with_query: 'There are no results for “{query}”.'
      },
      footbar: {
        signature: '@chatgpt-juarnamon intellectual property',
        aria_label: 'Application footer'
      }
    },
    history: {
      headers: {
        title: 'Title',
        num_players: 'Num players',
        winners: 'Winner/s',
        date: 'Date',
        status: 'Status',
        actions: 'Actions'
      }
    },
    status: {
      draft: 'Draft',
      waiting: 'Waiting',
      in_progress: 'In progress',
      paused: 'Paused',
      finished: 'Finished',
      cancelled: 'Cancelled'
    },
    app: {
      placeholders: {
        configure_title: 'Game configuration',
        session_title: 'Active session',
        session_id: 'Session ID: {id}'
      }
    }
  },
  es: {
    common: {
      app_name: 'Village Storyteller',
      untitled: 'Sin título',
      untitled_session: 'Sesión sin título',
      loading: 'Cargando…',
      error_prefix: 'Error',
      languages: {
        en: 'Inglés',
        es: 'Español',
        hu: 'Húngaro'
      },
      actions: {
        view: 'Ver',
        edit: 'Editar',
        delete: 'Eliminar'
      }
    },
    topbar: {
      title: 'Panel del Narrador',
      language_label: 'Idioma',
      change_language: 'Cambiar idioma',
      change_language_current: 'Cambiar idioma, actual: {language}',
      navigation_label: 'Barra de navegación'
    },
    header: {
      title: 'El Narrador de la Aldea',
      logo_alt: 'Logotipo de Village Storyteller'
    },
    login: {
      title: 'Login',
      storytellers: 'Narradores',
      players: 'Jugadores',
      choose_role: 'Elige cómo quieres entrar',
      registration_cta: 'Registro',
      form: {
        section_label: 'Accede con tu correo',
        email_label: 'Correo electrónico',
        email_placeholder: 'tu@ejemplo.com',
        password_label: 'Contraseña',
        password_placeholder: 'Introduce tu contraseña',
        submit: 'Iniciar sesión',
        forgot: '¿Olvidaste la contraseña?',
        role_label: '¿Cómo quieres acceder?',
        roles: {
          storyteller: 'Narrador',
          player: 'Jugador'
        },
        register_prompt: '¿Aún no tienes cuenta?',
        register_link: 'Regístrate aquí',
        errors: {
          missing_email: 'Introduce una dirección de correo.',
          invalid_email: 'Introduce una dirección de correo válida.',
          missing_password: 'Introduce tu contraseña.',
          invalid_credentials: 'Correo o contraseña incorrectos.',
          account_disabled: 'Esta cuenta está deshabilitada. Contacta con soporte.',
          too_many_attempts: 'Demasiados intentos. Intenta de nuevo más tarde.',
          generic: 'No se pudo iniciar sesión. Inténtalo de nuevo.'
        },
        success: {
          reset_link_sent: 'Si el correo existe, te hemos enviado un enlace de recuperación.'
        }
      }
    },
    registration: {
      title: 'Registro',
      placeholder: 'Página de registro (pendiente de implementar).'
    },
    landing: {
      current: {
        checking: 'Comprobando partida actual…',
        active_prefix: 'Partida activa:',
        no_active: 'No hay partidas activas ahora mismo.',
        create: 'Crear nueva partida',
        view: 'Ver partida actual'
      },
      history: {
        title: 'Histórico',
        search_placeholder: 'Buscar por título, estado o ganador…',
        loading: 'Cargando…',
        error_prefix: 'Error',
        empty: 'No hay sesiones registradas.',
        empty_with_query: 'No hay resultados para “{query}”.'
      },
      footbar: {
        signature: '@chatgpt-juarnamon propiedad intelectual',
        aria_label: 'Pie de aplicación'
      }
    },
    history: {
      headers: {
        title: 'Título',
        num_players: 'N.º jugadores',
        winners: 'Ganador/es',
        date: 'Fecha',
        status: 'Estado',
        actions: 'Acciones'
      }
    },
    status: {
      draft: 'Borrador',
      waiting: 'En espera',
      in_progress: 'En curso',
      paused: 'Pausada',
      finished: 'Terminada',
      cancelled: 'Cancelada'
    },
    app: {
      placeholders: {
        configure_title: 'Configuración de partida',
        session_title: 'Sesión en curso',
        session_id: 'ID de sesión: {id}'
      }
    }
  },
  hu: {
    common: {
      app_name: 'Falusi Mesemondó',
      untitled: 'Névtelen',
      untitled_session: 'Névtelen játék',
      loading: 'Betöltés…',
      error_prefix: 'Hiba',
      languages: {
        en: 'angol',
        es: 'spanyol',
        hu: 'magyar'
      },
      actions: {
        view: 'Megtekintés',
        edit: 'Szerkesztés',
        delete: 'Törlés'
      }
    },
    topbar: {
      title: 'Mesemondó vezérlőpult',
      language_label: 'Nyelv',
      change_language: 'Nyelv módosítása',
      change_language_current: 'Nyelv módosítása, aktuális: {language}',
      navigation_label: 'Fő navigáció'
    },
    header: {
      title: 'A falu mesemondója',
      logo_alt: 'Village Storyteller logó'
    },
    login: {
      title: 'Bejelentkezés',
      storytellers: 'Mesemondók',
      players: 'Játékosok',
      choose_role: 'Válaszd ki, hogyan szeretnél belépni',
      registration_cta: 'Regisztráció',
      form: {
        section_label: 'Lépj be e-maillel',
        email_label: 'E-mail',
        email_placeholder: 'te@pelda.hu',
        password_label: 'Jelszó',
        password_placeholder: 'Írd be a jelszavad',
        submit: 'Bejelentkezés',
        forgot: 'Elfelejtetted a jelszavad?',
        role_label: 'Belépés módja',
        roles: {
          storyteller: 'Mesemondó',
          player: 'Játékos'
        },
        register_prompt: 'Még nincs fiókod?',
        register_link: 'Regisztrálj itt',
        errors: {
          missing_email: 'Add meg az e-mail címed.',
          invalid_email: 'Adj meg érvényes e-mail címet.',
          missing_password: 'Add meg a jelszavad.',
          invalid_credentials: 'Hibás e-mail vagy jelszó.',
          account_disabled: 'Ez a fiók le van tiltva. Vedd fel a kapcsolatot a támogatással.',
          too_many_attempts: 'Túl sok próbálkozás. Próbáld később.',
          generic: 'A bejelentkezés nem sikerült. Próbáld újra.'
        },
        success: {
          reset_link_sent: 'Ha létezik a cím, elküldtük a helyreállító e-mailt.'
        }
      }
    },
    registration: {
      title: 'Regisztráció',
      placeholder: 'Regisztrációs oldal (később készül el).'
    },
    landing: {
      current: {
        checking: 'Aktuális játék ellenőrzése…',
        active_prefix: 'Aktív játék:',
        no_active: 'Jelenleg nincs aktív játék.',
        create: 'Új játék létrehozása',
        view: 'Aktív játék megnyitása'
      },
      history: {
        title: 'Előzmények',
        search_placeholder: 'Keresés cím, állapot vagy győztes alapján…',
        loading: 'Betöltés…',
        error_prefix: 'Hiba',
        empty: 'Nincsenek mentett játékok.',
        empty_with_query: 'Nincs találat erre: “{query}”.'
      },
      footbar: {
        signature: '@chatgpt-juarnamon szellemi tulajdona',
        aria_label: 'Alkalmazás lábléc'
      }
    },
    history: {
      headers: {
        title: 'Cím',
        num_players: 'Játékosok száma',
        winners: 'Győztes(ek)',
        date: 'Dátum',
        status: 'Állapot',
        actions: 'Műveletek'
      }
    },
    status: {
      draft: 'Piszkozat',
      waiting: 'Várakozik',
      in_progress: 'Folyamatban',
      paused: 'Szünetel',
      finished: 'Befejezve',
      cancelled: 'Törölve'
    },
    app: {
      placeholders: {
        configure_title: 'Játék beállítása',
        session_title: 'Folyamatban lévő játék',
        session_id: 'Játék azonosítója: {id}'
      }
    }
  }
};

export const dictionary = writable(dictionaries);

// Utilidad para resolver una clave "a.b.c" dentro del diccionario
function resolve(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

// Reemplazo de variables en cadenas: "Hola, {name}"
function interpolate(str, vars = {}) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

// Store derivado que devuelve una FUNCIÓN traductora reactiva
export const t = derived([dictionary, locale], ([$dict, $locale]) => {
  return (key, vars = {}) => {
    const pack = $dict[$locale] || $dict.es;
    const val = resolve(pack, key);
    if (val === undefined) {
      // Fallback: intenta ES → muestra la clave si no existe
      const fallback = resolve($dict.es, key);
      return interpolate(fallback !== undefined ? fallback : key, vars);
    }
    if (typeof val === 'string') {
      return interpolate(val, vars);
    }
    return val; // soporta objetos/arrays si alguna vez los necesitas
  };
});

// API imperativa por si la necesitas fuera de componentes
export function setLocale(next) {
  if (!availableLocales.includes(next)) return;
  locale.set(next);
}
