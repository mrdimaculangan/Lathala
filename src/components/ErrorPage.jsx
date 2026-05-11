import image from "../assets/errorimage.png"

function ErrorPage() {
    return (
        <div style={
            { backgroundColor: '#f0f0f0',
                padding: '20px',
                borderRadius: '8px',
                minHeight: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
            }
        }>
            <h1 style={{
                color: '#333',
                fontSize: '67px'
            }}>
                Error 404
            </h1>
            <p style={{
                color: '#666',
                lineHeight: '1.6',
                paddingBottom: '20px',
            }}>
                Page Not Found (aka we haven't done it yet gomene 𐙚🧸ྀི)
            </p>
            <img className="errorimage" src={image}
            style={{
                width: '45%',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: '20px'
            }}/>
        </div>
    );
}

export default ErrorPage;