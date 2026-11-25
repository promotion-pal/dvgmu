import Image from "next/image";
import { ComponentProps, FC } from "react";
import { appConfig } from "@/shared/config";

interface CommonPhotoProps extends Omit<ComponentProps<typeof Image>, 'src'> {
    src?: string
}

const CommonPhoto: FC<CommonPhotoProps> = ({ className, src, ...props }) => {
    if (!src) return <section
        className='w-full h-full flex items-center justify-center bg-zinc-100 text-primary rounded-lg'>{appConfig.company.name}</section>

    return <section className='relative'>
        <Image fill src={src} className={className} {...props} />
    </section>
}

export { CommonPhoto }