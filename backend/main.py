from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import zipfile
from PyPDF2 import PdfReader, PdfWriter
from pdf2docx import Converter
from docx2pdf import convert
import fitz
import img2pdf
from typing import List
from image_tools import (
    resize_image,
    crop_image,
    center_crop_image,
    aspect_ratio_crop,
    get_image_info,
    save_image,
    convert_to_grayscale,
    rotate_image,
    flip_image,
    adjust_brightness,
    adjust_contrast,
    adjust_saturation,
    apply_blur,
    apply_sharpen,
    compress_image,
)
from PIL import Image
from database import db_manager, to_json_serializable
import collections.abc

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def recursive_serialize(obj):
    if isinstance(obj, dict):
        return {k: recursive_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [recursive_serialize(v) for v in obj]
    else:
        return to_json_serializable(obj)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    with open(f"temp_{file.filename}", "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": file.filename}

@app.post("/api/split")
async def split_pdf(files: List[UploadFile] = File(...), split_type: str = Form(...), custom_ranges: str = Form("")):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    output_paths = []
    for file in files:
        file_path = f"temp_files/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        reader = PdfReader(file_path)
        total_pages = len(reader.pages)
        if total_pages == 0:
            continue
        if split_type == "one-one":
            for i in range(total_pages):
                writer = PdfWriter()
                writer.add_page(reader.pages[i])
                output_filename = f"temp_files/{file.filename.replace('.pdf', '')}_page_{i + 1}.pdf"
                with open(output_filename, "wb") as output_pdf:
                    writer.write(output_pdf)
                output_paths.append(output_filename)
        elif split_type == "two-two":
            for i in range(0, total_pages, 2):
                writer = PdfWriter()
                writer.add_page(reader.pages[i])
                if i + 1 < total_pages:
                    writer.add_page(reader.pages[i+1])
                output_filename = f"temp_files/{file.filename.replace('.pdf', '')}_pages_{i + 1}-{min(i+2, total_pages)}.pdf"
                with open(output_filename, "wb") as output_pdf:
                    writer.write(output_pdf)
                output_paths.append(output_filename)
        elif split_type == "custom":
            ranges = custom_ranges.split(',')
            for r in ranges:
                try:
                    start, end = map(int, r.split('-'))
                    if start < 1 or end > total_pages or start > end:
                        raise HTTPException(status_code=400, detail=f"Invalid page range: {r}. Pages must be within 1 and {total_pages} and start must be less than or equal to end.")
                    writer = PdfWriter()
                    for i in range(start - 1, end):
                        writer.add_page(reader.pages[i])
                    output_filename = f"temp_files/{file.filename.replace('.pdf', '')}_custom_{start}-{end}.pdf"
                    with open(output_filename, "wb") as output_pdf:
                        writer.write(output_pdf)
                    output_paths.append(output_filename)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid custom range format: {r}. Expected format like '1-5'.")
        else:
            raise HTTPException(status_code=400, detail="Invalid split type.")
    if not output_paths:
        raise HTTPException(status_code=400, detail="No pages were split based on the provided criteria.")
    zip_path = f"temp_files/split_results.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for output_file_path in output_paths:
            zipf.write(output_file_path, os.path.basename(output_file_path))
    return FileResponse(zip_path, media_type='application/zip', filename="split_results.zip")

@app.post("/api/merge")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Please select at least two files to merge.")
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    merger = PdfWriter()
    for file in files:
        file_path = f"temp_files/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        merger.append(file_path)
    output_filename = "temp_files/merged.pdf"
    with open(output_filename, "wb") as output_pdf:
        merger.write(output_pdf)
    merger.close()
    return FileResponse(output_filename, media_type='application/pdf', filename="merged.pdf")

@app.post("/api/pdf-to-doc")
async def pdf_to_doc(files: List[UploadFile] = File(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    output_paths = []
    for file in files:
        pdf_path = f"temp_files/{file.filename}"
        docx_path = f"temp_files/{file.filename.replace('.pdf', '.docx')}"
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        output_paths.append(docx_path)
    if not output_paths:
        raise HTTPException(status_code=400, detail="No files were converted.")
    zip_path = "temp_files/converted_docs.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for output_file_path in output_paths:
            zipf.write(output_file_path, os.path.basename(output_file_path))
    return FileResponse(zip_path, media_type='application/zip', filename="converted_docs.zip")

@app.post("/api/doc-to-pdf")
async def doc_to_pdf(files: List[UploadFile] = File(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    output_paths = []
    for file in files:
        docx_path = f"temp_files/{file.filename}"
        pdf_path = f"temp_files/{file.filename.replace('.docx', '.pdf')}"
        with open(docx_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        convert(docx_path, pdf_path)
        output_paths.append(pdf_path)
    if not output_paths:
        raise HTTPException(status_code=400, detail="No files were converted.")
    zip_path = "temp_files/converted_pdfs.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for output_file_path in output_paths:
            zipf.write(output_file_path, os.path.basename(output_file_path))
    return FileResponse(zip_path, media_type='application/zip', filename="converted_pdfs.zip")

@app.post("/api/extract-images")
async def extract_images(files: List[UploadFile] = File(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    image_paths = []
    for file in files:
        file_path = f"temp_files/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            for img_index, img in enumerate(doc.get_page_images(page_num)):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                image_filename = f"temp_files/{file.filename.replace('.pdf', '')}_page{page_num+1}_img{img_index+1}.{image_ext}"
                with open(image_filename, "wb") as img_file:
                    img_file.write(image_bytes)
                image_paths.append(image_filename)
    if not image_paths:
        raise HTTPException(status_code=400, detail="No images were extracted.")
    zip_path = "temp_files/extracted_images.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for image_path in image_paths:
            zipf.write(image_path, os.path.basename(image_path))
    return FileResponse(zip_path, media_type='application/zip', filename="extracted_images.zip")

@app.post("/api/images-to-pdf")
async def images_to_pdf(files: List[UploadFile] = File(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    image_paths = []
    for file in files:
        file_path = f"temp_files/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_paths.append(file_path)
    output_pdf_path = "temp_files/combined_images.pdf"
    with open(output_pdf_path, "wb") as f:
        f.write(img2pdf.convert(image_paths))
    return FileResponse(output_pdf_path, media_type='application/pdf', filename="combined_images.pdf")

@app.post("/api/resize-image")
async def resize_image_api(file: UploadFile = File(...), width: int = Form(...), height: int = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    resized_img = resize_image(file_path, width, height)
    output_path = f"temp_files/resized_{file.filename}"
    resized_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"resized_{file.filename}")

@app.post("/api/crop-image")
async def crop_image_api(file: UploadFile = File(...), left: int = Form(...), top: int = Form(...), right: int = Form(...), bottom: int = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    cropped_img = crop_image(file_path, left, top, right, bottom)
    output_path = f"temp_files/cropped_{file.filename}"
    cropped_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"cropped_{file.filename}")

@app.post("/api/get-image-info")
async def get_image_info_api(file: UploadFile = File(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    info = get_image_info(file_path)
    return JSONResponse(content=info)

@app.post("/api/save-image")
async def save_image_api(file: UploadFile = File(...), format: str = Form(...), quality: int = Form(80)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    img = Image.open(file_path)
    output_path = f"temp_files/saved_{file.filename}.{format.lower()}"
    save_image(img, output_path, format, quality)
    return FileResponse(output_path, media_type=f'image/{format.lower()}', filename=f"saved_{file.filename}.{format.lower()}")

@app.post("/api/convert-to-grayscale")
async def convert_to_grayscale_api(file: UploadFile = File(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    gray_img = convert_to_grayscale(file_path)
    output_path = f"temp_files/grayscale_{file.filename}"
    gray_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"grayscale_{file.filename}")

@app.post("/api/rotate-image")
async def rotate_image_api(file: UploadFile = File(...), angle: int = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    rotated_img = rotate_image(file_path, angle)
    output_path = f"temp_files/rotated_{file.filename}"
    rotated_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"rotated_{file.filename}")

@app.post("/api/flip-image")
async def flip_image_api(file: UploadFile = File(...), direction: str = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    flipped_img = flip_image(file_path, direction)
    output_path = f"temp_files/flipped_{file.filename}"
    flipped_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"flipped_{file.filename}")

@app.post("/api/adjust-brightness")
async def adjust_brightness_api(file: UploadFile = File(...), factor: float = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    adjusted_img = adjust_brightness(file_path, factor)
    output_path = f"temp_files/brightness_{file.filename}"
    adjusted_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"brightness_{file.filename}")

@app.post("/api/adjust-contrast")
async def adjust_contrast_api(file: UploadFile = File(...), factor: float = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    adjusted_img = adjust_contrast(file_path, factor)
    output_path = f"temp_files/contrast_{file.filename}"
    adjusted_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"contrast_{file.filename}")

@app.post("/api/adjust-saturation")
async def adjust_saturation_api(file: UploadFile = File(...), factor: float = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    adjusted_img = adjust_saturation(file_path, factor)
    output_path = f"temp_files/saturation_{file.filename}"
    adjusted_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"saturation_{file.filename}")

@app.post("/api/apply-blur")
async def apply_blur_api(file: UploadFile = File(...), radius: float = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    blurred_img = apply_blur(file_path, radius)
    output_path = f"temp_files/blurred_{file.filename}"
    blurred_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"blurred_{file.filename}")

@app.post("/api/apply-sharpen")
async def apply_sharpen_api(file: UploadFile = File(...), factor: float = Form(...)):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    sharpened_img = apply_sharpen(file_path, factor)
    output_path = f"temp_files/sharpened_{file.filename}"
    sharpened_img.save(output_path)
    return FileResponse(output_path, media_type='image/png', filename=f"sharpened_{file.filename}")

@app.post("/api/compress-image")
async def compress_image_api(file: UploadFile = File(...), quality: int = Form(80), format: str = Form("JPEG")):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    file_path = f"temp_files/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    compressed_img = compress_image(file_path, quality, format)
    output_path = f"temp_files/compressed_{file.filename}.{format.lower()}"
    save_image(compressed_img, output_path, format, quality)
    return FileResponse(output_path, media_type=f'image/{format.lower()}', filename=f"compressed_{file.filename}.{format.lower()}")

@app.post("/api/compress-pdf")
async def compress_pdf(files: List[UploadFile] = File(...), quality: str = Form("medium")):
    if not os.path.exists("temp_files"):
        os.makedirs("temp_files")
    output_paths = []
    errors = []
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            errors.append(f"File {file.filename} is not a PDF file.")
            continue
        file_path = f"temp_files/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        try:
            doc = fitz.open(file_path)
            if quality in ["low", "medium"]:
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    image_list = page.get_images()
                    for img_index, img in enumerate(image_list):
                        xref = img[0]
                        try:
                            pix = fitz.Pixmap(doc, xref)
                            if pix.n - pix.alpha < 4:
                                if quality == "low":
                                    pix = pix.tobytes("jpeg", quality=30)
                                elif quality == "medium":
                                    pix = pix.tobytes("jpeg", quality=60)
                                doc.update_stream(xref, pix)
                        except Exception:
                            continue
            if quality == "low":
                doc.save(f"temp_files/compressed_{file.filename}", 
                        garbage=4, deflate=True, clean=True, 
                        pretty=False, ascii=False)
            elif quality == "medium":
                doc.save(f"temp_files/compressed_{file.filename}", 
                        garbage=3, deflate=True, clean=True, 
                        pretty=False, ascii=False)
            elif quality == "high":
                doc.save(f"temp_files/compressed_{file.filename}", 
                        garbage=2, deflate=True, clean=True, 
                        pretty=False, ascii=False)
            else:
                errors.append(f"Invalid quality level for {file.filename}. Use 'low', 'medium', or 'high'.")
                doc.close()
                continue
            doc.close()
            output_path = f"temp_files/compressed_{file.filename}"
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                errors.append(f"Compression failed for {file.filename} (output missing or empty).")
            else:
                output_paths.append(output_path)
        except Exception as e:
            errors.append(f"Error compressing {file.filename}: {str(e)}")
    if errors:
        raise HTTPException(status_code=500, detail="; ".join(errors))
    if not output_paths:
        raise HTTPException(status_code=400, detail="No files were compressed.")
    if len(output_paths) > 1:
        zip_path = f"temp_files/compressed_pdfs.zip"
        try:
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for output_file_path in output_paths:
                    zipf.write(output_file_path, os.path.basename(output_file_path))
            if not os.path.exists(zip_path) or os.path.getsize(zip_path) == 0:
                raise Exception("ZIP file creation failed or is empty.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating ZIP: {str(e)}")
        return FileResponse(zip_path, media_type='application/zip', filename="compressed_pdfs.zip")
    else:
        return FileResponse(output_paths[0], media_type='application/pdf', filename=os.path.basename(output_paths[0]))

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    try:
        stats = db_manager.get_dashboard_stats()
        stats = recursive_serialize(stats)
        return JSONResponse(content=stats)
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        return JSONResponse(content={
            'today': {'visitors': 0, 'new_visitors': 0, 'operations': 0, 'successful': 0, 'failed': 0, 'data_processed': 0},
            'yesterday': {'visitors': 0, 'new_visitors': 0, 'operations': 0, 'successful': 0, 'failed': 0, 'data_processed': 0},
            'total': {'users': 0, 'operations': 0, 'successful': 0, 'failed': 0, 'data_processed': 0, 'avg_processing_time': 0},
            'operation_breakdown': [],
            'recent_operations': []
        }) 