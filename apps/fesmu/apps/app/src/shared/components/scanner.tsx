import { Html5QrcodeScanner, type QrcodeErrorCallback, type QrcodeSuccessCallback } from "html5-qrcode";
import { useEffect, useId, useRef } from "react";

// Html5QrcodeScannerConfig не экспортируется из пакета — берём из конструктора.
type Html5QrcodeScannerConfig = NonNullable<ConstructorParameters<typeof Html5QrcodeScanner>[1]>;

interface Html5QrcodePluginProps extends Html5QrcodeScannerConfig {
    verbose?: boolean;
    scannerRef?: React.RefObject<Html5QrcodeScanner | null>;
    qrCodeSuccessCallback: QrcodeSuccessCallback;
    qrCodeErrorCallback?: QrcodeErrorCallback;
}

/** Сканер QR с камеры или из картинки (перенесён из старого dvgmu). Работает и в
 * Safari на iPhone — html5-qrcode распознаёт сам, без BarcodeDetector. */
const Html5QrcodePlugin = ({
    fps,
    qrbox,
    aspectRatio,
    disableFlip,
    verbose = false,
    scannerRef,
    qrCodeSuccessCallback,
    qrCodeErrorCallback,
}: Html5QrcodePluginProps) => {
    // Колбэки — через ref: сканер монтируется один раз и не теряет разрешение камеры,
    // если вызывающий передаёт новые функции на каждый рендер.
    const callbacksRef = useRef({ qrCodeSuccessCallback, qrCodeErrorCallback });
    useEffect(() => {
        callbacksRef.current = { qrCodeSuccessCallback, qrCodeErrorCallback };
    });

    // html5-qrcode ищет область по id — делаем его уникальным на экземпляр.
    const qrcodeRegionId = `html5qr-code-region-${useId().replace(/:/g, "")}`;

    useEffect(() => {
        const config: Html5QrcodeScannerConfig = { fps, qrbox, aspectRatio, disableFlip };
        const scanner = new Html5QrcodeScanner(qrcodeRegionId, config, verbose);
        if (scannerRef) scannerRef.current = scanner;

        scanner.render(
            (decodedText, result) => callbacksRef.current.qrCodeSuccessCallback(decodedText, result),
            (errorMessage, error) => callbacksRef.current.qrCodeErrorCallback?.(errorMessage, error),
        );

        return () => {
            scanner.clear().catch((error) => console.error("Не удалось остановить сканер QR:", error));
            if (scannerRef) scannerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div id={qrcodeRegionId} />;
};

export { Html5QrcodePlugin };
export type { Html5QrcodeScannerConfig };
