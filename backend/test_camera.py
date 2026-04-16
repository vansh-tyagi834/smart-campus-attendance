import cv2

cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)  # try 0 first

while True:
    ret, frame = cap.read()
    if not ret:
        break
    cv2.imshow("Test Camera 0", frame)
    if cv2.waitKey(1) & 0xFF == 27:  # ESC to exit
        break

cap.release()
cv2.destroyAllWindows()
