import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { getSiteSettings } from "@/domains/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Política de privacidad | SOPROTELCO",
  description: "Política de tratamiento de datos personales de SOPROTELCO, conforme a la Ley 1581 de 2012.",
};

const UPDATED_AT = "14 de julio de 2026";

export default async function PrivacyPage() {
  const settings = await getSiteSettings();

  const sections: LegalSection[] = [
    {
      heading: "Responsable del tratamiento",
      body: (
        <p>
          {settings.siteName}, con domicilio en {settings.address}, es responsable del tratamiento de
          los datos personales recolectados a través de este sitio. Para cualquier solicitud
          relacionada con sus datos, puede escribir a {settings.contactEmail}.
        </p>
      ),
    },
    {
      heading: "Marco legal",
      body: (
        <p>
          Esta política se adopta conforme a la Ley 1581 de 2012, al Decreto 1377 de 2013 y demás normas
          que regulen la protección de datos personales en Colombia.
        </p>
      ),
    },
    {
      heading: "Datos que recolectamos",
      body: (
        <p>
          Recolectamos los datos que usted suministra voluntariamente: nombre, correo electrónico,
          teléfono, empresa y el contenido de sus mensajes o solicitudes de cotización. Si crea una
          cuenta, almacenamos además sus credenciales de acceso de forma cifrada. No recolectamos datos
          sensibles ni datos de menores de edad.
        </p>
      ),
    },
    {
      heading: "Finalidad del tratamiento",
      body: (
        <p>
          Los datos se utilizan para atender y responder solicitudes de cotización, prestar asesoría
          técnica y comercial, gestionar su cuenta, dar seguimiento a la relación comercial y cumplir
          obligaciones legales y contables. No vendemos ni cedemos sus datos a terceros con fines
          publicitarios.
        </p>
      ),
    },
    {
      heading: "Derechos del titular",
      body: (
        <p>
          Como titular, usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos, a
          solicitar prueba de la autorización otorgada, a ser informado sobre el uso dado a sus datos y
          a revocar la autorización cuando proceda. Puede ejercer estos derechos escribiendo a{" "}
          {settings.contactEmail}.
        </p>
      ),
    },
    {
      heading: "Conservación",
      body: (
        <p>
          Los datos se conservan mientras exista una relación comercial vigente y durante el término que
          exijan las obligaciones legales aplicables. Cumplido ese plazo, se suprimen o se anonimizan.
        </p>
      ),
    },
    {
      heading: "Seguridad",
      body: (
        <p>
          Aplicamos medidas técnicas y administrativas razonables para proteger los datos frente a
          acceso no autorizado, pérdida o alteración. Las contraseñas se almacenan cifradas y el acceso
          a la información está restringido al personal autorizado.
        </p>
      ),
    },
    {
      heading: "Cambios en esta política",
      body: (
        <p>
          Cualquier modificación sustancial se publicará en esta página, con actualización de la fecha
          indicada arriba. Le recomendamos revisarla periódicamente.
        </p>
      ),
    },
  ];

  return (
    <LegalPage
      title="Política de privacidad"
      intro={`Política de tratamiento de datos personales de ${settings.siteName}, conforme a la normativa colombiana.`}
      updatedAt={UPDATED_AT}
      sections={sections}
    />
  );
}
