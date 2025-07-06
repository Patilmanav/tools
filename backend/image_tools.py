from PIL import Image, ImageEnhance, ImageFilter

def resize_image(path, width, height):
    img = Image.open(path)
    return img.resize((width, height))

def crop_image(path, left, top, right, bottom):
    img = Image.open(path)
    return img.crop((left, top, right, bottom))

def center_crop_image(path, width, height):
    img = Image.open(path)
    img_width, img_height = img.size
    left = (img_width - width) // 2
    top = (img_height - height) // 2
    right = left + width
    bottom = top + height
    return img.crop((left, top, right, bottom))

def aspect_ratio_crop(path, aspect_width, aspect_height):
    img = Image.open(path)
    img_width, img_height = img.size
    target_ratio = aspect_width / aspect_height
    img_ratio = img_width / img_height
    if img_ratio > target_ratio:
        new_width = int(target_ratio * img_height)
        left = (img_width - new_width) // 2
        right = left + new_width
        top = 0
        bottom = img_height
    else:
        new_height = int(img_width / target_ratio)
        top = (img_height - new_height) // 2
        bottom = top + new_height
        left = 0
        right = img_width
    return img.crop((left, top, right, bottom))

def get_image_info(path):
    img = Image.open(path)
    return {
        "format": img.format,
        "mode": img.mode,
        "size": img.size,
    }

def save_image(img, path, format, quality):
    img.save(path, format=format, quality=quality)

def convert_to_grayscale(path):
    img = Image.open(path)
    return img.convert("L")

def rotate_image(path, angle):
    img = Image.open(path)
    return img.rotate(angle)

def flip_image(path, direction):
    img = Image.open(path)
    if direction == "horizontal":
        return img.transpose(Image.FLIP_LEFT_RIGHT)
    elif direction == "vertical":
        return img.transpose(Image.FLIP_TOP_BOTTOM)
    return img

def adjust_brightness(path, factor):
    img = Image.open(path)
    enhancer = ImageEnhance.Brightness(img)
    return enhancer.enhance(factor)

def adjust_contrast(path, factor):
    img = Image.open(path)
    enhancer = ImageEnhance.Contrast(img)
    return enhancer.enhance(factor)

def adjust_saturation(path, factor):
    img = Image.open(path)
    enhancer = ImageEnhance.Color(img)
    return enhancer.enhance(factor)

def apply_blur(path, radius):
    img = Image.open(path)
    return img.filter(ImageFilter.GaussianBlur(radius))

def apply_sharpen(path, factor):
    img = Image.open(path)
    enhancer = ImageEnhance.Sharpness(img)
    return enhancer.enhance(factor)

def compress_image(path, quality, format):
    img = Image.open(path)
    return img 