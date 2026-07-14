import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { getSiteSettings } from "@/domains/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Términos y condiciones | SOPROTELCO",
  description: "Términos y condiciones de uso del sitio y de los servicios de SOPROTELCO.",
};

const UPDATED_AT = "14 de julio de 2026";

export default async function TermsPage() {
  const settings = await getSiteSettings();

  const sections: LegalSection[] = [
    {
      heading: "Objeto y aceptación",
      body: (
        <p>
          Estos términos regulan el acceso y uso del sitio web de {settings.siteName}. Al navegar el
          sitio, solicitar una cotización o crear una cuenta, el usuario declara que ha leído y acepta
          estas condiciones. Si no está de acuerdo, debe abstenerse de usar el sitio.
        </p>
      ),
    },
    {
      heading: "Naturaleza del catálogo",
      body: (
        <>
          <p>
            La información del catálogo (referencias, especificaciones, imágenes y precios) tiene
            carácter informativo y no constituye una oferta comercial vinculante.
          </p>
          <p>
            La disponibilidad y los precios pueden variar sin aviso previo. Toda operación queda sujeta
            a confirmación expresa por parte de {settings.siteName} mediante la cotización
            correspondiente.
          </p>
        </>
      ),
    },
    {
      heading: "Cotizaciones",
      body: (
        <p>
          Las solicitudes enviadas a través del sitio son requerimientos de cotización, no órdenes de
          compra. Una cotización solo obliga a las partes cuando ha sido emitida formalmente por{" "}
          {settings.siteName}, se encuentra dentro de su plazo de vigencia y ha sido aceptada por el
          cliente.
        </p>
      ),
    },
    {
      heading: "Cuentas de usuario",
      body: (
        <p>
          El usuario es responsable de la veracidad de los datos que registra y de la custodia de sus
          credenciales, así como de toda actividad realizada desde su cuenta. Debe notificar de
          inmediato cualquier uso no autorizado al correo {settings.contactEmail}.
        </p>
      ),
    },
    {
      heading: "Propiedad intelectual",
      body: (
        <p>
          Las marcas, logotipos, textos, imágenes y demás contenidos del sitio son propiedad de{" "}
          {settings.siteName} o de sus titulares y están protegidos por la normativa aplicable. No se
          autoriza su reproducción o uso comercial sin autorización previa y escrita.
        </p>
      ),
    },
    {
      heading: "Limitación de responsabilidad",
      body: (
        <p>
          {settings.siteName} no garantiza la disponibilidad ininterrumpida del sitio ni responde por
          daños derivados de su uso indebido, de la interrupción del servicio o de la exactitud de
          contenidos suministrados por terceros. La selección técnica final de los equipos es
          responsabilidad del cliente, sin perjuicio de la asesoría prestada.
        </p>
      ),
    },
    {
      heading: "Ley aplicable",
      body: (
        <p>
          Estos términos se rigen por la legislación de la República de Colombia. Cualquier controversia
          se someterá a los jueces competentes del domicilio de {settings.siteName} ({settings.address}
          ).
        </p>
      ),
    },
    {
      heading: "Contacto",
      body: (
        <p>
          Para consultas sobre estos términos, escriba a {settings.contactEmail} o comuníquese con
          nuestras oficinas en {settings.address}.
        </p>
      ),
    },
  ];

  return (
    <LegalPage
      title="Términos y condiciones"
      intro={`Condiciones de uso del sitio web y de los servicios ofrecidos por ${settings.siteName}.`}
      updatedAt={UPDATED_AT}
      sections={sections}
    />
  );
}
