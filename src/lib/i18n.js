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
      intro: 'Complete the form to create your account.',
      name_label: 'Full name',
      name_placeholder: 'John Doe',
      alias_label: 'Nickname',
      alias_placeholder: 'Optional nickname',
      avatar_label: 'Avatar image',
      avatar_help: 'JPG or PNG up to 5 MB.',
      avatar_wip: '- work in progress',
      optional: 'optional',
      email_label: 'Email address',
      email_placeholder: 'you@example.com',
      password_label: 'Password',
      password_requirements: 'Use at least 10 characters with uppercase, lowercase, numbers and symbols.',
      password_placeholder: 'Create a secure password',
      confirm_password_label: 'Confirm password',
      confirm_password_placeholder: 'Repeat the password',
      submit: 'Create account',
      uploading: 'Uploading…',
      back_to_login: 'Back to login',
      success: {
        verification_sent: 'We have sent a verification email to {email}. Please check your inbox.'
      },
      errors: {
        registration_error: 'Could not complete registration. Please try again.',
        password_mismatch: 'Passwords do not match.',
        password_strength: 'Password does not meet the security requirements.',
        email_in_use: 'There is already an account with this email address.',
        upload_failed: 'We could not upload the avatar image. Please try again.',
        upload_not_configured: 'Avatar upload is not configured. Please contact the administrator.'
      }
    },
    player: {
      choose_title: 'Player Dashboard',
      join_methods: 'Choose how to join',
      join_intro: 'Scan a QR code, enter a session ID or pick one from the list.',
      scan_qr: 'Scan QR code',
      session_id: 'Session ID',
      session_id_placeholder: 'Enter the session ID',
      session_id_hint: 'You will find this code on the storyteller’s screen.',
      connect: 'Connect',
      connect_selected: 'Connect to selected session',
      active_sessions: 'Available sessions',
      refresh: 'Refresh',
      loading: 'Loading sessions…',
      no_sessions: 'No sessions available right now.',
      load_error: 'Unable to load sessions. Try again.',
      invalid_id: 'We could not find that session.',
      connect_error: 'Could not connect to the session. Please try again.',
      created_at: 'Created',
      updated_at: 'Updated'
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
      intro: 'Completa el formulario para crear tu cuenta.',
      name_label: 'Nombre completo',
      name_placeholder: 'Marina Pérez',
      alias_label: 'Apodo',
      alias_placeholder: 'Apodo opcional',
      avatar_label: 'Imagen de avatar',
      avatar_help: 'JPG o PNG de hasta 5 MB.',
      avatar_wip: '- en desarrollo',
      optional: 'opcional',
      email_label: 'Correo electrónico',
      email_placeholder: 'tu@ejemplo.com',
      password_label: 'Contraseña',
      password_requirements: 'Usa al menos 10 caracteres combinando mayúsculas, minúsculas, números y símbolos.',
      password_placeholder: 'Crea una contraseña segura',
      confirm_password_label: 'Confirmar contraseña',
      confirm_password_placeholder: 'Repite la contraseña',
      submit: 'Crear cuenta',
      uploading: 'Subiendo…',
      back_to_login: 'Volver a iniciar sesión',
      success: {
        verification_sent: 'Hemos enviado un correo de verificación a {email}. Revisa tu bandeja.'
      },
      errors: {
        registration_error: 'No se pudo completar el registro. Inténtalo de nuevo.',
        password_mismatch: 'Las contraseñas no coinciden.',
        password_strength: 'La contraseña no cumple los requisitos de seguridad.',
        email_in_use: 'Ya existe una cuenta con este correo electrónico.',
        upload_failed: 'No se pudo subir la imagen. Inténtalo de nuevo.',
        upload_not_configured: 'La subida de avatar no está configurada. Contacta con el administrador.'
      }
    },
    player: {
      choose_title: 'Panel del Jugador',
      join_methods: 'Elige cómo unirte',
      join_intro: 'Escanea un código QR, escribe un ID de sesión o selecciona una partida activa.',
      scan_qr: 'Escanear código QR',
      session_id: 'ID de sesión',
      session_id_placeholder: 'Introduce el ID de sesión',
      session_id_hint: 'Encontrarás este código en la pantalla del narrador.',
      connect: 'Conectar',
      connect_selected: 'Conectar con la partida seleccionada',
      active_sessions: 'Partidas disponibles',
      refresh: 'Actualizar',
      loading: 'Cargando partidas…',
      no_sessions: 'No hay partidas disponibles ahora mismo.',
      load_error: 'No se pudo cargar la lista de partidas.',
      invalid_id: 'No encontramos una partida con ese ID.',
      connect_error: 'No se pudo conectar a la partida. Inténtalo de nuevo.',
      created_at: 'Creada',
      updated_at: 'Actualizada'
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
      intro: 'Töltsd ki az űrlapot a fiók létrehozásához.',
      name_label: 'Teljes név',
      name_placeholder: 'Kovács Anna',
      alias_label: 'Becenév',
      alias_placeholder: 'Választható becenév',
      avatar_label: 'Avatar kép',
      avatar_help: 'JPG vagy PNG, legfeljebb 5 MB.',
      avatar_wip: '- fejlesztés alatt',
      optional: 'opcionális',
      email_label: 'E-mail cím',
      email_placeholder: 'te@pelda.hu',
      password_label: 'Jelszó',
      password_requirements: 'Használj legalább 10 karaktert nagybetűkkel, kisbetűkkel, számokkal és szimbólumokkal.',
      password_placeholder: 'Adj meg biztonságos jelszót',
      confirm_password_label: 'Jelszó megerősítése',
      confirm_password_placeholder: 'Ismételd meg a jelszót',
      submit: 'Fiók létrehozása',
      uploading: 'Feltöltés…',
      back_to_login: 'Vissza a bejelentkezéshez',
      success: {
        verification_sent: 'Ellenőrző e-mailt küldtünk a következő címre: {email}. Kérjük, nézd meg a postaládádat.'
      },
      errors: {
        registration_error: 'A regisztráció nem sikerült. Próbáld újra.',
        password_mismatch: 'A jelszavak nem egyeznek.',
        password_strength: 'A jelszó nem felel meg a biztonsági követelményeknek.',
        email_in_use: 'Ezzel az e-mail címmel már létezik fiók.',
        upload_failed: 'Nem sikerült feltölteni az avatárt. Próbáld újra.',
        upload_not_configured: 'Az avatar feltöltése nincs beállítva. Vedd fel a kapcsolatot az adminnal.'
      }
    },
    player: {
      choose_title: 'Játékos vezérlőpult',
      join_methods: 'Válaszd ki a csatlakozás módját',
      join_intro: 'Olvass be egy QR-kódot, írd be a session azonosítót vagy válassz egy aktív játékot.',
      scan_qr: 'QR-kód beolvasása',
      session_id: 'Session azonosító',
      session_id_placeholder: 'Írd be a session azonosítót',
      session_id_hint: 'A kódot a mesélő képernyőjén találod.',
      connect: 'Csatlakozás',
      connect_selected: 'Csatlakozás a kiválasztott játékhoz',
      active_sessions: 'Elérhető játékok',
      refresh: 'Frissítés',
      loading: 'Játékok betöltése…',
      no_sessions: 'Jelenleg nincs elérhető játék.',
      load_error: 'Nem sikerült betölteni a játékokat.',
      invalid_id: 'Nem található ilyen azonosítójú játék.',
      connect_error: 'Nem sikerült csatlakozni a játékhoz. Próbáld újra.',
      created_at: 'Létrehozva',
      updated_at: 'Frissítve'
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
