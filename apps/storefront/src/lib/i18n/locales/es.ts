const es = {
  langSelector: {
    title: "¿En qué idioma prefieres navegar?",
    subtitle: "Puedes cambiarlo en cualquier momento.",
    spanish: "Español",
    english: "Inglés",
  },
  promoBanner: {
    title: "Hoy no hay novedades",
    subtitle: "Vuelve pronto, estamos preparando algo especial para ti.",
    understood: "Entendido",
    close: "Cerrar",
    prev: "Anterior",
    next: "Siguiente",
    goToSlide: "Ver anuncio {{n}}",
    navigationLabel: "Anuncios",
  },
  nav: {
    goHome: "Ir al inicio",
    contact: "Contacto",
    location: "Ubicación",
    upcomingEvents: "Próximos Eventos",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    home: "Inicio",
    aboutUs: "Quiénes Somos",
    store: "Tienda",
    certifications: "Certificaciones",
    policyInocuity: "Aviso de Privacidad",
    policyEnvironmental: "Privacidad de Cookies",
  },
  events: {
    title: "Novedades",
    swipeHint: "Desliza para ver más",
    months: [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ],
  },
  certifications: {
    eyebrow: "Certificaciones",
    title: "",
    subtitle: "ESTÁNDARES DE CALIDAD Y CERTIFICADOS",
    description:
      "Nuestros estándares de aseguramiento de calidad, protocolos y procedimientos incluyen inspecciones cuidadosas a lo largo de todas las fases de nuestra operación para asegurarnos de que solamente los productos de la más alta calidad lleguen a usted y a su familia.",
    tapHint: "Toca un certificado para abrir su PDF",
    viewPdf: "Ver certificado PDF de {{name}}",
    openPdf: "Abrir certificado de {{name}}",
    clickToView: "Clic para ver PDF",
  },
  catalog: {
    title: "Catálogo de Productos",
    selectProduct: "Selecciona un producto",
    comingSoon: "Proximamente...",
    weight: "Gramaje",
    all: "Todos",
    prevLogo: "Logo anterior",
    nextLogo: "Logo siguiente",
    carousel: "Carrusel de productos",
    prevProduct: "Producto anterior",
    nextProduct: "Próximo producto",
    noResults: "No hay productos que coincidan con los filtros",
    general: "General",
    specs: "Specs",
    downloadSpecs: "Descargar Specs",
    viewDetails: "Ver Detalles",
    technicalSheet: "Ficha Técnica",
  },
  contact: {
    title: "Contacto",
    subtitle: "Selecciona el área adecuada",
    submitNote:
      "Al enviar, nos comprometeremos a direccionar tu solicitud al equipo correcto.",
    submitting: "Enviando...",
    error: {
      generic: "Ocurrió un error al enviar tu solicitud. Intenta de nuevo.",
      network: "No se pudo conectar con el servidor. Verifica tu conexión.",
      rateLimit: "Demasiadas solicitudes. Intenta de nuevo en una hora.",
    },
    selectChannel: "Selecciona un canal",
    whichQuery: "¿Cuál es tu consulta?",
    chooseTheme:
      "Elige el tema para que tu solicitud llegue directamente al equipo indicado.",
    activeChannel: "Canal activo",
    fields: {
      contactData: "Datos de contacto",
      contactDataHint:
        "Usaremos esta información para responderte y canalizar tu solicitud.",
      location: "Ubicación",
      requestDetail: "Detalle de solicitud",
      requestDetailHint:
        "Comparte el contexto para dirigir tu solicitud con mayor claridad.",
      firstName: "Nombre *",
      firstNamePlaceholder: "Nombre",
      lastName: "Apellido *",
      lastNamePlaceholder: "Apellido",
      email: "Correo electrónico *",
      emailPlaceholder: "nombre@empresa.com",
      extension: "Extensión",
      extensionPlaceholder: "52",
      phone: "Teléfono *",
      phonePlaceholder: "55 1234 5678",
      country: "País",
      countryPlaceholder: "País",
      city: "Ciudad",
      cityPlaceholder: "Ciudad",
      postalCode: "C.P.",
      postalCodePlaceholder: "Código postal",
      message: "Comentario o mensaje *",
      emailInvalid: "Ingresa un correo válido (ejemplo: nombre@empresa.com)",
      validation: {
        required: "Este campo es obligatorio",
        email: "Ingresa un correo electrónico válido",
        phone: "Ingresa un teléfono válido (mínimo 10 dígitos)",
        minLength: "Mínimo {{count}} caracteres",
        name: "Ingresa un nombre válido",
        cooldown: "Espera {{seconds}}s",
      },
    },
    success: {
      title: "Solicitud recibida",
      message:
        "El siguiente paso será responderte por el correo que capturaste en el formulario.",
      newRequest: "Nueva solicitud",
      close: "Cerrar",
    },
    topics: {
      nationalSales: {
        label: "Informes para venta nacional",
        eyebrow: "Área comercial",
        title: "Ventas nacionales",
        description:
          "Distribución, cadenas, autoservicio y oportunidades dentro de México.",
        submitLabel: "Enviar solicitud",
        successMessage:
          "Tu solicitud para ventas nacionales fue registrada correctamente.",
        successDetail:
          "Te contactaremos pronto al correo que capturaste. Revisa tu bandeja de entrada o spam.",
        messagePlaceholder:
          "Cuéntanos qué canal, volumen o formato te interesa.",
      },
      internationalSales: {
        label: "Informes para exportación",
        eyebrow: "Global outreach",
        title: "Ventas internacionales",
        description:
          "Exportación, private label y desarrollo comercial para nuevos mercados.",
        submitLabel: "Enviar solicitud",
        successMessage:
          "Tu solicitud para ventas internacionales fue registrada correctamente.",
        successDetail:
          "Te contactaremos pronto al correo que capturaste. Revisa tu bandeja de entrada o spam.",
        messagePlaceholder:
          "Comparte mercado objetivo, volumen estimado o requerimientos de exportación.",
      },
      customerService: {
        label: "Servicio al cliente",
        eyebrow: "Atención directa",
        title: "Servicio al cliente",
        description:
          "Seguimiento, soporte, dudas de producto y atención postventa.",
        submitLabel: "Enviar mensaje",
        successMessage:
          "Tu mensaje para servicio al cliente fue enviado correctamente.",
        successDetail:
          "Te contactaremos pronto al correo que capturaste. Revisa tu bandeja de entrada o spam.",
        messagePlaceholder:
          "Describe brevemente tu duda, pedido o seguimiento.",
      },
      catalogue: {
        label: "Catálogo completo",
        eyebrow: "Material comercial",
        title: "Solicitar catálogo completo",
        description:
          "Te compartimos por correo el material comercial de la marca según tu interés.",
        submitLabel: "Solicitar catálogo",
        successMessage:
          "Tu solicitud de catálogo completo fue registrada correctamente.",
        successDetail:
          "Te enviamos el catálogo completo. Llega en los próximos minutos a tu bandeja; si no aparece, revisa spam o promociones.",
        messagePlaceholder:
          "Indica qué línea, mercado o tipo de catálogo necesitas.",
      },
    },
  },
  about: {
    titleLines: ["Nuestro", "Dulce ADN"],
    description:
      "Nuestra misión, visión, valores y objetivos no son solo palabras: son el corazón que guía nuestras decisiones, inspira nuestro trabajo y fortalece nuestra unión como equipo.",
    layers: {
      mission: {
        kicker: "",
        title: "Misión",
        body: "Creamos gomas, caramelos y productos frutales llenos de sabor y calidad, hechos con compromiso, seguridad y responsabilidad, para brindar bienestar y una experiencia deliciosa en cada bite.",
        detail: "experiencia y sofisticación",
      },
      vision: {
        kicker: "",
        title: "Visión",
        body: "Ser la marca líder nacional e internacional en gomas, caramelos y productos frutales, reconocida por su innovación, calidad y compromiso; inspirando confianza y bienestar en cada cliente, destacando por nuestro sabor y experiencia sensorial.",
        detail: "referencia global",
      },
      values: {
        kicker: "",
        title: "Valores",
        detail: "coherencia y excelencia",
        items: {
          trust: {
            title: "Confianza",
            description:
              "Base de nuestras relaciones; actuamos con transparencia, cumplimiento y coherencia.",
          },
          integrity: {
            title: "Integridad",
            description:
              "Mantenemos un comportamiento ético y honesto en cada decisión.",
          },
          responsibility: {
            title: "Responsabilidad",
            description:
              "Cumplimos con calidad, seguridad e inocuidad, asegurando el bienestar del consumidor.",
          },
          innovation: {
            title: "Innovación",
            description:
              "Impulsamos la creatividad, la mejora continua y la búsqueda de nuevas soluciones que fortalezcan nuestros productos y procesos.",
          },
          reliability: {
            title: "Fiabilidad",
            description:
              "Generamos seguridad y consistencia en nuestras operaciones y relaciones.",
          },
          generosity: {
            title: "Generosidad",
            description:
              "Promovemos la colaboración, el respeto y el apoyo mutuo dentro y fuera de la empresa.",
          },
        },
      },
    },
  },
  tagline: {
    subtitle: "AQUÍ LA MARCA SE VIVE DESDE ADENTRO",
    description: "Te invitamos a conocer y disfrutar de un lugar increíble donde encontrarás toda nuestra línea de productos, incluyendo caramelos, gomitas y varias sorpresas más. ¡Ven y descubre el sabor único de Jovy!",
    gallery: "Galería",
    galleryLabel: "CASA JOVY EN IMÁGENES",
    noImages: "No hay imágenes publicadas en Casa Jovy.",
    imgAlt: "Casa Jovy galería {{index}}",
    imgAriaLabel: "Ver imagen completa Casa Jovy galería {{index}}",
    socialTitle: "LAS REDES DE JOVY",
    socialSubtitle: "UNA DULCE ALDEA",
    socialDescription: "¡Únete y síguenos en nuestras redes sociales para conocer nuestros nuevos lanzamientos, eventos y actividades, te queremos sorprender!",
  },
  footer: {
    followUs: "SÍGUENOS EN REDES",
    latestPosts: "Últimas publicaciones",
    follow: "Seguir",
    viewProfile: "Ver perfil completo",
    latestUpdates: "Últimas actualizaciones",
    contact: "Contacto",
    rights: "© 2026 Jovy. Todos los derechos reservados.",
    postAlt: "Publicación {{index}}",
  },
  location: {
    title: "Ubicación",
    subtitle: "Visitas y coordinación",
    visitIntro: "Coordinamos visitas comerciales y reuniones",
    visitDescription:
      "Procesadora De Alimentos Cale, S.A. De C.V. abre sus puertas bajo coordinación previa. Contáctanos para preparar tu visita.",
    mapTitle: "Mapa de ubicación de Dulces Jovy",
    address: "Dirección",
    phone: "Teléfono",
    hours: "Horario",
    email: "Email",
  },
  dates: {
    january: "enero",
    february: "febrero",
    march: "marzo",
    april: "abril",
    may: "mayo",
    june: "junio",
    july: "julio",
    august: "agosto",
    september: "septiembre",
    october: "octubre",
    november: "noviembre",
    december: "diciembre",
  },
  casa_jovy: {
    instagram_label: "Instagram",
    instagram_handle: "CasaJovyMX",
    instagram_detail: "Vida diaria, cocina, montaje y detalles del espacio.",
    facebook_label: "Facebook",
    facebook_handle: "/CasaJovyMX",
    facebook_detail: "Agenda, eventos privados y novedades de la casa.",
    tiktok_label: "TikTok",
    tiktok_handle: "@casajovymx",
    tiktok_detail: "Recorridos, recetas y momentos compartidos.",
  },
} as const;

export default es;
