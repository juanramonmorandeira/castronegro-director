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
      change_language_current: 'Change language, current: {language}'
    },
    header: {
      title: 'The Village Storyteller',
      logo_alt: 'Village Storyteller logo'
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
      change_language_current: 'Cambiar idioma, actual: {language}'
    },
    header: {
      title: 'El Narrador de la Aldea',
      logo_alt: 'Logotipo de Village Storyteller'
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
      change_language_current: 'Nyelv módosítása, aktuális: {language}'
    },
    header: {
      title: 'A falu mesemondója',
      logo_alt: 'Village Storyteller logó'
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
