/**
 * Plain-language legal summaries. These are product drafts to be reviewed by counsel
 * before launch (consumer law, GDPR/RODO, digital content rules differ per market).
 */
type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };
type Docs = { privacy: Doc; terms: Doc };

export const LEGAL: Record<"en" | "pl" | "es", Docs> = {
  en: {
    privacy: {
      title: "Privacy",
      updated: "Draft — October 2026",
      sections: [
        { h: "What we collect", p: ["To create a personal session we need only your first name, the recording language and your choices in the form. Everything else — a favourite place, an intention, personal context — is optional.", "We never ask for diagnoses, health conditions or therapy notes, and you should not enter them."] },
        { h: "How it is used", p: ["Your inputs are used to write the script for your session and to generate the audio. Personal context is used only in the categories you allowed, and you can switch it off at any time.", "Scripts may be written with the help of an AI language model (Anthropic) and voiced by a text-to-speech provider (ElevenLabs). They process the text only to deliver the service."] },
        { h: "Storage & access", p: ["Recordings are stored privately. They can be played only by your account through short-lived signed links.", "Previews created before signing in are deleted after 30 days unless you create an account. Temporary working files are deleted as soon as a recording is finished."] },
        { h: "Your control", p: ["You can edit or delete your personalization profile, export your data, and delete your account — all from your Personalization Profile. Deleting your account removes your recordings."] },
        { h: "Marketing", p: ["Marketing emails are separate from registration and require a separate, optional consent that you can withdraw at any time."] },
        { h: "Processors", p: ["Supabase (database, authentication, storage), ElevenLabs (voice synthesis), Anthropic (script writing), Stripe (payments). Each processes data under a data processing agreement."] },
      ],
    },
    terms: {
      title: "Terms",
      updated: "Draft — October 2026",
      sections: [
        { h: "What OpenWithin is", p: ["OpenWithin provides personalized audio for relaxation, meditation, visualization and self-reflection. It is not a medical service, not therapy and not a substitute for professional care. If you are struggling, please contact a qualified professional or local emergency services."] },
        { h: "Using sessions safely", p: ["Do not listen while driving or doing anything that needs your full attention. You can stop or pause any session at any time. If an exercise feels uncomfortable, stop it or choose a different version."] },
        { h: "Digital content", p: ["Recordings are digital content delivered immediately after purchase. Before payment you are asked to agree to immediate delivery and to acknowledge that you lose the right of withdrawal once the content has been delivered. If a generation fails, you are not charged for it, and a used credit is returned."] },
        { h: "Professionals & the Store", p: ["Professionals who publish in OpenWithin Studio are responsible for the content and accuracy of their programmes and confirm they hold the qualifications they state. Programmes must not be presented as treatment. OpenWithin may review, suspend or remove content."] },
        { h: "Voice cloning", p: ["A professional's own voice can be cloned only after identity verification and explicit consent of the voice owner, in line with our voice provider's terms."] },
        { h: "Payments", p: ["Payments are processed by Stripe. Prices are shown in your local currency. Subscriptions renew monthly until cancelled."] },
      ],
    },
  },
  pl: {
    privacy: {
      title: "Prywatność",
      updated: "Wersja robocza — październik 2026",
      sections: [
        { h: "Jakie dane zbieramy", p: ["Do stworzenia osobistej sesji potrzebujemy tylko Twojego imienia, języka nagrania i wyborów w formularzu. Wszystko inne — ulubione miejsce, intencja, osobisty kontekst — jest opcjonalne.", "Nigdy nie prosimy o diagnozy, informacje o zdrowiu ani notatki z terapii i nie należy ich wpisywać."] },
        { h: "Jak je wykorzystujemy", p: ["Twoje odpowiedzi służą do napisania scenariusza sesji i wygenerowania nagrania. Osobisty kontekst jest używany wyłącznie w kategoriach, na które pozwolisz, i możesz go w każdej chwili wyłączyć.", "Scenariusze mogą powstawać z pomocą modelu językowego AI (Anthropic), a głos generuje dostawca syntezy mowy (ElevenLabs). Przetwarzają oni tekst wyłącznie w celu świadczenia usługi."] },
        { h: "Przechowywanie i dostęp", p: ["Nagrania są przechowywane prywatnie. Odtworzyć je może tylko Twoje konto, przez krótkotrwałe podpisane linki.", "Próbki utworzone przed zalogowaniem są usuwane po 30 dniach, jeśli nie założysz konta. Robocze pliki tymczasowe usuwamy zaraz po zakończeniu nagrania."] },
        { h: "Twoja kontrola", p: ["W Profilu personalizacji możesz edytować lub usunąć profil, pobrać swoje dane i usunąć konto. Usunięcie konta usuwa także nagrania."] },
        { h: "Marketing", p: ["E-maile marketingowe są oddzielone od rejestracji i wymagają osobnej, dobrowolnej zgody, którą możesz w każdej chwili wycofać."] },
        { h: "Podmioty przetwarzające", p: ["Supabase (baza danych, logowanie, przechowywanie plików), ElevenLabs (synteza głosu), Anthropic (pisanie scenariuszy), Stripe (płatności). Każdy przetwarza dane na podstawie umowy powierzenia."] },
      ],
    },
    terms: {
      title: "Regulamin",
      updated: "Wersja robocza — październik 2026",
      sections: [
        { h: "Czym jest OpenWithin", p: ["OpenWithin dostarcza spersonalizowane nagrania do relaksacji, medytacji, wizualizacji i autorefleksji. Nie jest usługą medyczną, terapią ani zamiennikiem profesjonalnej pomocy. Jeśli przeżywasz trudności, skontaktuj się z wykwalifikowanym specjalistą lub numerem alarmowym."] },
        { h: "Bezpieczne korzystanie", p: ["Nie słuchaj nagrań podczas prowadzenia pojazdu ani czynności wymagających pełnej uwagi. Każdą sesję możesz w każdej chwili przerwać. Jeśli ćwiczenie jest nieprzyjemne, zatrzymaj je lub wybierz inną wersję."] },
        { h: "Treści cyfrowe", p: ["Nagrania są treściami cyfrowymi dostarczanymi od razu po zakupie. Przed płatnością prosimy o zgodę na natychmiastowe dostarczenie i potwierdzenie, że po dostarczeniu tracisz prawo odstąpienia od umowy. Jeśli generowanie się nie powiedzie, nie pobieramy opłaty, a wykorzystany kredyt wraca na konto."] },
        { h: "Specjaliści i Sklep", p: ["Specjaliści publikujący w OpenWithin Studio odpowiadają za treść i rzetelność swoich programów oraz potwierdzają posiadanie deklarowanych kwalifikacji. Programy nie mogą być przedstawiane jako leczenie. OpenWithin może weryfikować, wstrzymywać lub usuwać treści."] },
        { h: "Klonowanie głosu", p: ["Głos specjalisty może zostać sklonowany wyłącznie po weryfikacji tożsamości i wyraźnej zgodzie właściciela głosu, zgodnie z regulaminem dostawcy."] },
        { h: "Płatności", p: ["Płatności obsługuje Stripe. Ceny prezentujemy w lokalnej walucie. Subskrypcje odnawiają się co miesiąc do czasu anulowania."] },
      ],
    },
  },
  es: {
    privacy: {
      title: "Privacidad",
      updated: "Borrador — octubre de 2026",
      sections: [
        { h: "Qué datos recogemos", p: ["Para crear una sesión personal solo necesitamos tu nombre, el idioma de la grabación y tus elecciones en el formulario. Todo lo demás —un lugar favorito, una intención, contexto personal— es opcional.", "Nunca pedimos diagnósticos, información de salud ni notas de terapia, y no deberías introducirlos."] },
        { h: "Cómo los usamos", p: ["Tus respuestas sirven para escribir el guion de tu sesión y generar el audio. El contexto personal solo se usa en las categorías que permitas y puedes desactivarlo cuando quieras.", "Los guiones pueden escribirse con ayuda de un modelo de lenguaje de IA (Anthropic) y la voz la genera un proveedor de síntesis (ElevenLabs). Solo procesan el texto para prestar el servicio."] },
        { h: "Almacenamiento y acceso", p: ["Las grabaciones se guardan de forma privada. Solo tu cuenta puede reproducirlas mediante enlaces firmados de corta duración.", "Las muestras creadas antes de iniciar sesión se eliminan a los 30 días si no creas una cuenta. Los archivos de trabajo temporales se borran en cuanto termina la grabación."] },
        { h: "Tu control", p: ["Desde tu Perfil de personalización puedes editar o borrar tu perfil, exportar tus datos y eliminar tu cuenta. Al eliminar la cuenta se borran tus grabaciones."] },
        { h: "Marketing", p: ["Los correos de marketing están separados del registro y requieren un consentimiento aparte y opcional que puedes retirar en cualquier momento."] },
        { h: "Encargados del tratamiento", p: ["Supabase (base de datos, autenticación, almacenamiento), ElevenLabs (síntesis de voz), Anthropic (redacción de guiones), Stripe (pagos). Cada uno trata los datos según un acuerdo de encargo."] },
      ],
    },
    terms: {
      title: "Condiciones",
      updated: "Borrador — octubre de 2026",
      sections: [
        { h: "Qué es OpenWithin", p: ["OpenWithin ofrece audio personalizado para relajación, meditación, visualización y autorreflexión. No es un servicio médico, ni una terapia, ni sustituye la ayuda profesional. Si lo estás pasando mal, contacta con un profesional cualificado o con los servicios de emergencia."] },
        { h: "Uso seguro", p: ["No escuches las sesiones mientras conduces ni haciendo algo que requiera toda tu atención. Puedes detener o pausar cualquier sesión en cualquier momento. Si un ejercicio te resulta incómodo, detenlo o elige otra versión."] },
        { h: "Contenido digital", p: ["Las grabaciones son contenido digital que se entrega inmediatamente tras la compra. Antes del pago te pedimos que aceptes la entrega inmediata y que reconozcas que pierdes el derecho de desistimiento una vez entregado. Si una generación falla, no se te cobra y el crédito utilizado se devuelve."] },
        { h: "Profesionales y la Tienda", p: ["Los profesionales que publican en OpenWithin Studio son responsables del contenido y la exactitud de sus programas y confirman que poseen las cualificaciones que declaran. Los programas no pueden presentarse como tratamiento. OpenWithin puede revisar, suspender o retirar contenidos."] },
        { h: "Clonación de voz", p: ["La voz de un profesional solo puede clonarse tras verificar su identidad y con el consentimiento explícito del titular de la voz, conforme a las condiciones del proveedor."] },
        { h: "Pagos", p: ["Los pagos los procesa Stripe. Los precios se muestran en tu moneda local. Las suscripciones se renuevan cada mes hasta que se cancelan."] },
      ],
    },
  },
};
